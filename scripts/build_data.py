"""Build the vegetarian/vegan recipe data for Munchee (What Should I Eat?).

Source: Food.com recipes (Majumder et al., 2019 — Kaggle "Food.com Recipes and
User Interactions"), via the Hugging Face mirror KingName1/food.com.

The mirror has 11 shards (~8k recipes each, names sorted "0"…"F"). Run from the
munchee/ folder:
    uv run --with pandas --with pyarrow --with fsspec --with aiohttp --with truststore \
      python scripts/build_data.py --fetch

--fetch downloads only the columns we use (~4 MB of each 17 MB shard, skipping the
embedding column) into data/raw/. Later runs can omit it to rebuild from the cache.

Outputs plain .js files (not .json) so the page also works when opened via file://.
"""

import glob
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT_INDEX = os.path.join(ROOT, "data", "recipes-index.js")
OUT_STEPS = os.path.join(ROOT, "data", "steps")
RECIPES_PER_SHARD = 150
SHARD_URL = "https://huggingface.co/datasets/KingName1/food.com/resolve/main/data/recipes_{}.parquet"
NUM_SHARDS = 11
COLUMNS = ["name", "minutes", "steps", "description", "ingredients", "calories", "total fat (PDV)",
           "sugar (PDV)", "sodium (PDV)", "protein (PDV)", "saturated fat (PDV)", "carbohydrates (PDV)"]


def fetch():
    import fsspec
    import pyarrow.parquet as pq

    try:
        import truststore  # use the OS certificate store (needed behind TLS-inspecting proxies)
        truststore.inject_into_ssl()
    except ImportError:
        pass

    os.makedirs(RAW, exist_ok=True)
    for i in range(NUM_SHARDS):
        path = os.path.join(RAW, f"recipes_{i}.parquet")
        if os.path.exists(path):
            pd.read_parquet(path, columns=COLUMNS).to_parquet(path, index=False)
            print(f"shard {i}: cached")
            continue
        # A seekable remote file lets pyarrow range-read just the footer and the wanted column chunks.
        with fsspec.open(SHARD_URL.format(i), "rb", block_size=2**20) as fh:
            df = pq.read_table(fh, columns=COLUMNS).to_pandas()
        df.to_parquet(path, index=False)
        print(f"shard {i}: fetched {len(df):,} recipes")

# --- Normalization (keep in sync with normalize() in js/app.js) -------------

NO_SINGULAR = {"molasses", "hummus", "asparagus", "couscous", "swiss", "grits", "brussels", "citrus"}
IRREGULAR = {"leaves": "leaf", "halves": "half", "loaves": "loaf", "chilies": "chili", "chillies": "chili",
             "cookies": "cookie", "veggies": "veggie", "smoothies": "smoothie", "brownies": "brownie"}


def singular(w):
    if w in NO_SINGULAR:
        return w
    if w in IRREGULAR:
        return IRREGULAR[w]
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("oes"):
        return w[:-2]
    if w.endswith("s") and len(w) > 3 and not w.endswith(("ss", "us", "is")):
        return w[:-1]
    return w


def normalize(text):
    plain = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", text.lower()))  # "jalapeño" -> "jalapeno"
    words = re.sub(r"[^a-z\s]", " ", plain).split()
    return " ".join(singular(w) for w in words)


# Regional names, alternate spellings and typos -> the form the page uses. Normalized (singular) and matched on
# whole words, longest first. Shipped to the page so typed input maps the same way. Spelling variants are listed
# by hand: automatic near-spelling merges in this data are mostly wrong (spiced/sliced, besan/bean, morel/morsel).
ALIASES = {
    "panir": "paneer", "paneer cheese": "paneer",
    "garbanzo bean": "chickpea", "garbanzo": "chickpea", "chick pea": "chickpea",
    "besan": "chickpea flour", "gram flour": "chickpea flour",
    "scallion": "green onion", "spring onion": "green onion",
    "aubergine": "eggplant", "courgette": "zucchini", "capsicum": "bell pepper", "rocket": "arugula",
    "cornflour": "cornstarch", "bean curd": "tofu", "soya": "soy",
    "methi leaf": "fenugreek leaf", "methi": "fenugreek leaf",
    "fresh coriander": "fresh cilantro", "green coriander": "cilantro", "coriander leaf": "cilantro",
    "yoghurt": "yogurt", "chile": "chili", "chilis": "chili", "chilie": "chili", "catsup": "ketchup",
    "filo": "phyllo", "bulgar": "bulgur", "whisky": "whiskey", "portobello": "portabella",
    "peppar": "pepper", "tomatoe": "tomato", "limon": "lemon", "bakin": "baking",
}
ALIAS_ORDER = sorted(ALIASES, key=len, reverse=True)


def apply_aliases(norm):
    s = f" {norm} "
    for _ in range(3):  # "panir cheese" -> "paneer cheese" -> "paneer"
        before = s
        for a in ALIAS_ORDER:
            s = s.replace(f" {a} ", f" {ALIASES[a]} ")
        if s == before:
            break
    return s.strip()


def merge_spacing(recipes):
    """'sweetcorn' and 'sweet corn', 'hardboiled egg' and 'hard boiled egg': keep whichever is more common."""
    counts = Counter(n for r in recipes for n in r["ings"])
    best = {}
    for n, _ in counts.most_common():
        best.setdefault(n.replace(" ", ""), n)
    for r in recipes:
        for field in ("ings", "key"):
            r[field] = list(dict.fromkeys(best[n.replace(" ", "")] for n in r[field]))


# --- Diet classification from ingredient text --------------------------------

MEAT = re.compile(
    r"\b(chicken|beef|pork|bacon|ham|sausages?|turkey|lamb|veal|steaks?|salami|pepperoni|prosciutto|"
    r"chorizo|pancetta|meats?|meatballs?|hamburgers?|hot dogs?|frankfurters?|bratwurst|kielbasa|"
    r"fish|salmon|tuna|cod|tilapia|halibut|trout|anchov\w*|sardines?|shrimps?|prawns?|crab|crabmeat|"
    r"grouper|snapper|catfish|haddock|flounder|swordfish|mahi|pollock|whitefish|perch|sea bass|fillets?|"
    r"lobster|clams?|mussels?|oysters?|scallops?|squid|calamari|octopus|gelatin|gelatine|jell-o|jello|"
    r"lard|suet|duck|goose|venison|bison|rabbit|worcestershire|caviar|bouillon|broth|stock|drippings|"
    r"liver|brisket|sirloin|tenderloin|pastrami|corned|mincemeat|marshmallows?|scungilli|escargot|snails?|conch)\b"
)
MEAT_OK = re.compile(
    r"\b(vegetarian|vegan|veggie|meatless|soy|tofu|tempeh|seitan|plant based|mock)\b"
    r"|\b(vegetable|mushroom)\b.*\b(broth|stock|bouillon)\b|\bcoconut meat\b"
)

ANIMAL = [
    (re.compile(r"\b(eggs?|egg whites?|egg yolks?|yolks?|eggnog)\b"), re.compile(r"\b(replacer|vegan)\b")),
    (re.compile(r"\bmilk\b"), re.compile(r"\b(soy|almond|coconut|oat|rice|cashew|hemp|plant|non-dairy|nondairy|vegan|dairy-free)\b")),
    (re.compile(r"\bbutter\b"), re.compile(r"\b(peanut|almond|cashew|apple|nut|sunflower|cocoa|shea|vegan|soy|seed|tahini|pumpkin|hazelnut|beans?|earth balance)\b")),
    (re.compile(r"\b(cheese|cheddar|mozzarella|parmesan|romano|feta|ricotta|paneer|gouda|brie|provolone|gruyere|"
                r"monterey|colby|mascarpone|neufchatel|halloumi|asiago|pecorino|queso|velveeta)\b"),
     re.compile(r"\b(vegan|soy|nutritional|dairy-free|non-dairy|cashew)\b")),
    (re.compile(r"\b(cream|creamer)\b"), re.compile(r"\b(coconut|tartar|vegan|soy|non-dairy|nondairy)\b")),
    (re.compile(r"\b(yogurt|yoghurt)\b"), re.compile(r"\b(soy|coconut|vegan|almond|dairy-free)\b")),
    (re.compile(r"\b(mayonnaise|mayo)\b"), re.compile(r"\bvegan\b")),
    (re.compile(r"\bcurd\b"), re.compile(r"\bbean\b")),
    (re.compile(r"\b(honey|ghee|whey|casein|custard|buttermilk|kefir|half-and-half|whipped topping|cool whip|"
                r"m ms|reese|cookie dough|nutella|caramels?|toffee)\b"), None),
]


def with_singular(text):
    """Regexes list singular forms; also test the singularized text so plurals ('chickens') match."""
    return f"{text} | {normalize(text)}"


def has_meat(text):
    t = with_singular(text)
    return bool(MEAT.search(t)) and not MEAT_OK.search(t)


def is_vegetarian(name, ings):
    return not has_meat(name) and not any(has_meat(i) for i in ings)


def contains_animal(texts, rules):
    for t in map(with_singular, texts):
        for bad, ok in rules:
            if bad.search(t) and not (ok and ok.search(t)):
                return True
    return False


# Steps sometimes add things missing from the ingredient list ("sprinkle with parmesan").
# "cream" and "milk" are skipped there: "cream the sugar and margarine" is a verb.
STEP_ANIMAL = [rule for rule in ANIMAL if not rule[0].search("cream") and not rule[0].search("milk")]


def is_vegan(ings, steps):
    return not contains_animal(ings, ANIMAL) and not contains_animal([s.lower() for s in steps], STEP_ANIMAL)


# --- Course from recipe name -------------------------------------------------

SWEET_ANY = set(normalize(
    "cake cakes cupcakes cookies brownies blondies fudge cheesecake muffins frosting icing pudding cobbler "
    "crumble dessert sorbet sherbet mousse toffee biscotti macaroons meringue doughnuts donuts scones "
    "shortbread truffles candy brittle caramels pralines snickerdoodles"
).split())
SWEET_LAST = set(normalize("pie tart tarts bars bar crisp jam jelly marmalade preserves compote parfait").split())
SAVORY_PIE = set(normalize("pot shepherd shepherds cottage tomato spinach vegetable savory pizza onion mushroom potato zucchini").split())
DRINK_LAST = set(normalize(
    "smoothie smoothies shake shakes milkshake lemonade punch tea chai coffee latte cocoa cocktail martini "
    "mojito sangria daiquiri liqueur cordial juice drink beverage spritzer toddy cider lassi frappe slush "
    "wine mimosa margaritas"
).split())
CONDIMENT_LAST = set(normalize(
    "sauce dressing vinaigrette marinade rub seasoning mix blend chutney relish pesto aioli mayonnaise "
    "ketchup mustard gravy stock broth spread paste glaze syrup salsa butter oil vinegar powder spice spices"
).split())


def course(name):
    words = normalize(name).split()
    if not words:
        return "main"
    last = words[-1]
    if last in DRINK_LAST:
        return "drink"
    if SWEET_ANY & set(words) or (last in SWEET_LAST and not SAVORY_PIE & set(words)):
        return "sweet"
    if last in CONDIMENT_LAST:
        return "condiment"
    return "main"


COURSE_CODE = {"main": 0, "sweet": 1, "drink": 2, "condiment": 3}

# --- Dish grouping ------------------------------------------------------------
# Recipes whose names reduce to the same key ("Easy Tomato Soup", "Mom's Tomato Soup II") are versions of
# one dish. The group size is the popularity proxy: the mirror has no ids, so Food.com ratings can't be joined.

NAME_FILLER = set(normalize(
    "a an the and with in on of for to n my our your easy easiest best quick quicker simple yummy yummiest "
    "delicious famous perfect ultimate healthy healthier homemade home made classic amazing awesome favorite "
    "favourite fabulous fantastic wonderful great good tasty super really very absolutely incredible "
    "ii iii iv v recipe version style copycat low fat free light lighter skinny ww point minute minutes "
    "old fashioned fashion grandma grandmas mom moms mommy aunt auntie granny nana mama world worlds the "
    "crazy killer awesome excellent outstanding fresh real authentic traditional basic"
).split())


def name_words(title):
    words = [w for w in title.split() if not w.endswith(("'s", "'"))]
    return [w for w in normalize(" ".join(words)).split() if w not in NAME_FILLER]


def dish_key(title):
    """Near-duplicate key: same meaningful words in any order."""
    return " ".join(sorted(set(name_words(title)))) or normalize(title)


def dish_type(title):
    """Broader dish for popularity: last two meaningful words, e.g. "Creamy Roasted Tomato Soup" -> "tomato soup"."""
    return " ".join(name_words(title)[-2:]) or normalize(title)


# --- Pantry staples (assumed on hand, not counted as missing) ---------------

PANTRY_WORDS = set(normalize(
    "salt pepper black white ground fresh freshly kosher sea table coarse cracked oil olive extra virgin "
    "vegetable canola cooking spray nonstick water cold hot warm boiling ice cube sugar granulated brown "
    "light dark powdered confectioners all purpose flour plain baking soda powder and of to taste"
).split())
PANTRY_CORE = set(normalize("salt pepper oil water sugar flour ice spray soda powder").split())


def is_pantry(norm):
    words = norm.split()
    return bool(words) and all(w in PANTRY_WORDS for w in words) and any(w in PANTRY_CORE for w in words)


# --- Near-duplicate recipes ----------------------------------------------------
# Food.com has many re-posts of the same recipe under a different name. A recipe is dropped when a kept one
# shares most of its main ingredients and follows similar steps. Ingredients are compared by main noun, like
# the page's "hide similar" filter, so "roma tomato" = "tomato" and "garlic clove" = "garlic".
# Both comparisons weight items by rarity (log N / count): sharing avocado or tomatillo says far more than
# sharing butter and egg, and "mash" or "griddle" in the steps far more than "add" or "stir". Unweighted,
# every butter-egg-vanilla bake looks the same.

SAME_INGREDIENTS = 0.75  # weighted share of main ingredients, out of the longer list
SAME_STEPS = 0.1         # weighted Jaccard of step words; unrelated methods score ~0.02-0.05

# Keep in sync with PART_WORDS in js/app.js.
PART_WORDS = {"clove", "leaf", "sprig", "juice", "zest", "wedge", "slice", "piece", "chunk", "half", "floret", "stalk",
              "rib", "spear", "head", "bulb", "kernel", "segment", "ring", "strip", "cube", "dice"}


def head_word(norm):
    words = norm.split()
    end = len(words)
    while end > 1 and words[end - 1] in PART_WORDS:
        end -= 1
    return words[end - 1]


def rarity_weights(sets):
    counts = Counter(x for s in sets for x in s)
    return {x: math.log(len(sets) / c) for x, c in counts.items()}


def find_duplicates(recipes):
    """Indexes of recipes to drop. Walks recipes best-first (popular dish, has a description, more detailed steps)
    and drops any that duplicates one already kept. Prefix filtering keeps it fast: two lists sharing >= t of
    their weight must share one item from each list's rarest items covering more than 1 - t of its weight."""
    heads = [frozenset(head_word(n) for n in r["key"]) for r in recipes]
    words = [frozenset(re.sub(r"[^a-z\s]", " ", " ".join(r["steps"]).lower()).split()) for r in recipes]
    hw, ww = rarity_weights(heads), rarity_weights(words)
    weight = lambda items, w: sum(w[x] for x in items)
    head_total = [weight(hs, hw) for hs in heads]

    order = sorted(range(len(recipes)), key=lambda i: (-recipes[i]["pop"], not recipes[i]["desc"], -len(" ".join(recipes[i]["steps"]))))
    index, dropped = {}, set()
    for i in order:
        prefix, rest = [], head_total[i]
        for h in sorted(heads[i], key=lambda h: (-hw[h], h)):
            if rest < SAME_INGREDIENTS * head_total[i] - 1e-9:
                break
            prefix.append(h)
            rest -= hw[h]
        candidates = {j for h in prefix for j in index.get(h, ())}
        if any(
            weight(heads[i] & heads[j], hw) >= SAME_INGREDIENTS * max(head_total[i], head_total[j])
            and weight(words[i] & words[j], ww) >= SAME_STEPS * weight(words[i] | words[j], ww)
            for j in candidates
        ):
            dropped.add(i)
            continue
        for h in prefix:
            index.setdefault(h, []).append(i)
    return dropped


# --- Helpers -----------------------------------------------------------------

def clean_ingredient(raw):
    # Food.com splits "juice of 1 lemon" into "lemon, juice of" and "a few sprigs of fresh mint" into "of fresh mint".
    n = re.sub(r"^(of|a|an) ", "", normalize(raw))
    return "" if n.endswith(" of") or n in {"juice", "zest"} else apply_aliases(n)


def title_case(name):
    # Food.com strips apostrophes: "alicia s potato soup", "i don t have".
    name = re.sub(r"\b(\w+) (s|t|ll|re|ve|d)\b", r"\1'\2", re.sub(r"\s+", " ", name).strip())
    # ...and accented letters: "saut", "pur e", "cr me br l e".
    for broken, fixed in [(r"\bsaut\b", "sauté"), (r"\bsaut ed\b", "sautéed"), (r"\bpur e\b", "purée"),
                          (r"\bcr me\b", "crème"), (r"\bbr l e\b", "brûlée"), (r"\bjalape o\b", "jalapeño"),
                          (r"\bfrapp\b", "frappé"), (r"\bcaf\b", "café"), (r"\bsouffl\b", "soufflé"), (r"\bsouffls\b", "soufflés"), (r"\bflamb\b", "flambé")]:
        name = re.sub(broken, fixed, name)
    small = {"a", "an", "and", "or", "the", "of", "with", "in", "on", "for", "to", "n"}
    return " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(name.split(" ")))


def sentence(s):
    s = re.sub(r"\s+([,.;:!?)])", r"\1", re.sub(r"\s+", " ", str(s)).strip())
    return s[:1].upper() + s[1:]


def num(v):
    try:
        f = float(v)
        return 0 if math.isnan(f) else f
    except (TypeError, ValueError):
        return 0


def main():
    if "--fetch" in sys.argv:
        fetch()
    files = sorted(glob.glob(os.path.join(RAW, "recipes_*.parquet")))
    if not files:
        raise SystemExit(f"No recipes_*.parquet in {RAW} — run with --fetch.")
    df = pd.concat([pd.read_parquet(f, columns=COLUMNS) for f in files], ignore_index=True)
    print(f"Loaded {len(df):,} recipes from {len(files)} file(s)")

    kept, seen = [], set()
    stats = Counter()
    for row in df.itertuples(index=False):
        name = title_case(str(row.name or ""))
        raw_ings = [i.strip().lower() for i in str(row.ingredients or "").split(",") if i.strip()]
        steps = [sentence(s) for s in (list(row.steps) if row.steps is not None else []) if str(s).strip()]
        minutes = int(num(row.minutes))
        cal = num(row.calories)
        if not name or name.lower() in seen or not steps or not (1 <= minutes <= 300) or not (0 < cal <= 2500):
            stats["bad_row"] += 1
            continue
        if not is_vegetarian(name.lower(), raw_ings):
            stats["not_veg"] += 1
            continue
        norm_ings = list(dict.fromkeys(n for n in map(clean_ingredient, raw_ings) if n))
        key_ings = [n for n in norm_ings if not is_pantry(n)]
        if not (3 <= len(key_ings) <= 25):
            stats["too_few_or_many_ingredients"] += 1
            continue
        seen.add(name.lower())
        kept.append({
            "name": name,
            "minutes": minutes,
            "vegan": is_vegan(raw_ings, steps),
            "course": course(name),
            "ings": norm_ings,
            "key": key_ings,
            # calories, then %DV for fat, sugar, sodium, protein, saturated fat, carbs (column order above)
            "nut": [cal, *(num(row[c]) for c in range(6, 12))],
            "steps": steps,
            "desc": sentence(row.description)[:400] if isinstance(row.description, str) else "",
        })

    merge_spacing(kept)
    type_count = Counter(dish_type(r["name"]) for r in kept)
    for r in kept:
        r["pop"] = type_count[dish_type(r["name"])]
    dropped = find_duplicates(kept)
    stats["near_duplicate"] = len(dropped)
    kept = [r for i, r in enumerate(kept) if i not in dropped]

    freq = Counter(n for r in kept for n in r["ings"])
    vocab = [w for w, _ in freq.most_common()]
    vid = {w: i for i, w in enumerate(vocab)}
    pantry_ids = [i for i, w in enumerate(vocab) if is_pantry(w)]

    keys = [dish_key(r["name"]) for r in kept]
    group_of = {k: g for g, (k, _) in enumerate(Counter(keys).most_common())}
    types = [dish_type(r["name"]) for r in kept]
    type_count = Counter(types)

    shards = max(1, math.ceil(len(kept) / RECIPES_PER_SHARD))
    recipes, shard_data = [], [dict() for _ in range(shards)]
    for i, r in enumerate(kept):
        recipes.append([
            r["name"], r["minutes"], 1 if r["vegan"] else 0, COURSE_CODE[r["course"]],
            [round(x) for x in r["nut"]], [vid[n] for n in r["ings"]], group_of[keys[i]], type_count[types[i]],
        ])
        shard_data[i % shards][i] = [r["desc"], r["steps"]]

    os.makedirs(OUT_STEPS, exist_ok=True)
    for f in glob.glob(os.path.join(OUT_STEPS, "*.js")):
        os.remove(f)
    for s, data in enumerate(shard_data):
        with open(os.path.join(OUT_STEPS, f"{s}.js"), "w", encoding="utf-8") as fh:
            fh.write(f"window.__recipeSteps({s},{json.dumps(data, ensure_ascii=False, separators=(',', ':'))});\n")

    payload = {"source": "Food.com (Kaggle: Food.com Recipes and User Interactions)",
               "shards": shards, "vocab": vocab, "pantry": pantry_ids, "aliases": ALIASES, "recipes": recipes}
    with open(OUT_INDEX, "w", encoding="utf-8") as fh:
        fh.write("window.RECIPE_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")

    vegan = sum(r["vegan"] for r in kept)
    courses = Counter(r["course"] for r in kept)
    print(f"Kept {len(kept):,} recipes ({vegan:,} vegan) · {len(vocab):,} distinct ingredients · {shards} step shards")
    print("Courses:", dict(courses), "· Skipped:", dict(stats))
    print(f"Near-duplicate groups: {len(group_of):,} · popular dish types: {type_count.most_common(20)}")
    print(f"Index size: {os.path.getsize(OUT_INDEX) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

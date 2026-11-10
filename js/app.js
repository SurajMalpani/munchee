(() => {
  const D = window.RECIPE_DATA;
  const PAGE_SIZE = 5;
  const AUTOCOMPLETE_SIZE = 2500;
  const TOP_PER_CATEGORY = 7;

  // Index into each recipe's nutrition array; dv = the daily value Food.com's %DV figures are based on.
  const NUTRIENTS = [
    { i: 0, label: "Calories", unit: "kcal" },
    { i: 4, label: "Protein", unit: "g", dv: 50 },
    { i: 6, label: "Carbohydrates", unit: "g", dv: 300 },
    { i: 2, label: "Sugar", unit: "g", dv: 50 },
    { i: 1, label: "Total fat", unit: "g", dv: 65 },
    { i: 5, label: "Saturated fat", unit: "g", dv: 20 },
    { i: 3, label: "Sodium", unit: "mg", dv: 2400 },
  ];
  const amount = (r, i) => (i === 0 ? r.nut[0] : (r.nut[i] * NUTRIENTS.find((n) => n.i === i).dv) / 100);

  const GOALS = {
    highProtein: { label: "High protein", hint: "≥ 20 g", test: (r) => amount(r, 4) >= 20 },
    lowCarb:     { label: "Low carb",     hint: "≤ 30 g", test: (r) => amount(r, 6) <= 30 },
    lowCalorie:  { label: "Low calorie",  hint: "≤ 400 kcal", test: (r) => amount(r, 0) <= 400 },
    lowSugar:    { label: "Low sugar",    hint: "≤ 10 g", test: (r) => amount(r, 2) <= 10 },
    lowFat:      { label: "Low fat",      hint: "≤ 15 g", test: (r) => amount(r, 1) <= 15 },
    lowSodium:   { label: "Low sodium",   hint: "≤ 600 mg", test: (r) => amount(r, 3) <= 600 },
  };

  // Names must be in normalized form (see normalize()); ones missing from the dataset are hidden.
  // Only the most-used few per group show until the group is expanded; order here doesn't matter.
  const CATEGORIES = {
    "Vegetables": ["onion", "garlic", "tomato", "potato", "sweet potato", "carrot", "bell pepper", "red bell pepper", "spinach", "broccoli", "cauliflower", "zucchini", "mushroom", "eggplant", "cabbage", "kale", "celery", "cucumber", "corn", "frozen pea", "green bean", "asparagus", "lettuce", "butternut squash", "beet", "leek", "jalapeno", "avocado", "pumpkin", "shallot", "green onion", "artichoke heart", "brussels sprout", "okra", "fennel"],
    "Fruit": ["lemon", "lime", "banana", "apple", "orange", "strawberry", "blueberry", "raspberry", "mango", "pineapple", "raisin", "dried cranberry", "coconut", "peach", "pear", "grape", "date", "cherry", "kiwi", "watermelon"],
    "Beans & plant protein": ["tofu", "firm tofu", "tempeh", "chickpea", "black bean", "kidney bean", "lentil", "red lentil", "white bean", "cannellini bean", "pinto bean", "edamame", "split pea", "refried bean", "textured vegetable protein", "seitan"],
    "Grains, pasta & bread": ["rice", "brown rice", "basmati rice", "quinoa", "pasta", "spaghetti", "penne pasta", "egg noodle", "rice noodle", "rolled oat", "bread", "flour tortilla", "corn tortilla", "couscous", "barley", "bulgur", "pita bread", "cornmeal", "polenta", "breadcrumb"],
    "Eggs & dairy": ["egg", "milk", "butter", "cheddar cheese", "parmesan cheese", "mozzarella cheese", "feta cheese", "plain yogurt", "greek yogurt", "cream cheese", "sour cream", "heavy cream", "ricotta cheese", "paneer", "goat cheese", "swiss cheese"],
    "Plant milks & vegan staples": ["soymilk", "almond milk", "coconut milk", "rice milk", "nutritional yeast", "vegan margarine", "silken tofu", "coconut cream"],
    "Nuts & seeds": ["almond", "walnut", "cashew", "peanut", "pecan", "pine nut", "sesame seed", "sunflower seed", "pumpkin seed", "chia seed", "flax seed", "peanut butter", "almond butter", "tahini"],
    "Herbs & spices": ["basil", "fresh basil", "cilantro", "parsley", "fresh ginger", "ground cumin", "paprika", "chili powder", "dried oregano", "dried thyme", "fresh rosemary", "ground cinnamon", "turmeric", "curry powder", "garam masala", "red pepper flake", "dill", "fresh mint", "cayenne pepper", "nutmeg"],
    "Sauces & pantry": ["soy sauce", "balsamic vinegar", "red wine vinegar", "rice vinegar", "maple syrup", "honey", "tomato paste", "diced tomato", "tomato sauce", "salsa", "vegetable broth", "dijon mustard", "sesame oil", "coconut oil", "hot sauce", "lemon juice", "lime juice", "pesto sauce", "kalamata olive", "caper"],
  };

  const EMOJI = [
    [/smoothie|shake|lassi/, "🥤"], [/tea|chai|latte|coffee|cocoa/, "☕"], [/lemonade|punch|juice|cocktail|margarita|sangria|mojito|martini/, "🍹"],
    [/pizza/, "🍕"], [/taco|burrito|enchilada|quesadilla|fajita/, "🌮"], [/burger/, "🍔"], [/sandwich|wrap|panini/, "🥪"],
    [/pasta|spaghetti|linguine|fettuccine|penne|lasagna|macaroni|noodle|ziti|gnocchi/, "🍝"], [/curry|dal|dhal|masala|korma/, "🍛"],
    [/soup|stew|chili|chowder|bisque|gazpacho/, "🥣"], [/salad|slaw/, "🥗"], [/rice|risotto|pilaf|biryani|paella/, "🍚"],
    [/pancake|crepe|waffle/, "🥞"], [/egg|omelet|frittata|quiche|shakshuka/, "🍳"], [/bread|loaf|roll|bun|biscuit|focaccia/, "🍞"],
    [/cake|cupcake|cheesecake/, "🍰"], [/cookie|biscotti|shortbread/, "🍪"], [/brownie|fudge|chocolate|truffle/, "🍫"], [/pie|tart|cobbler|crisp|crumble/, "🥧"],
    [/muffin|scone/, "🧁"], [/ice cream|sorbet|frozen/, "🍨"], [/potato|fries|hash/, "🥔"], [/tofu|tempeh|stir fry/, "🥢"],
    [/dip|hummus|salsa|guacamole/, "🥙"], [/sauce|dressing|pesto|vinaigrette|gravy/, "🫙"], [/bean|lentil|chickpea/, "🫘"],
    [/mushroom/, "🍄"], [/corn/, "🌽"], [/apple/, "🍎"], [/banana/, "🍌"], [/berry|berries/, "🍓"], [/carrot/, "🥕"], [/avocado/, "🥑"],
  ].map(([re, emoji]) => [new RegExp(`\\b(?:${re.source})`), emoji]);

  // --- Normalization (keep in sync with normalize() in scripts/build_data.py) ---
  const NO_SINGULAR = new Set(["molasses", "hummus", "asparagus", "couscous", "swiss", "grits", "brussels", "citrus"]);
  const IRREGULAR = { leaves: "leaf", halves: "half", loaves: "loaf", chilies: "chili", chillies: "chili", cookies: "cookie", veggies: "veggie", smoothies: "smoothie", brownies: "brownie" };

  function singular(w) {
    if (NO_SINGULAR.has(w)) return w;
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    if (w.endsWith("oes")) return w.slice(0, -2);
    if (w.endsWith("s") && w.length > 3 && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function normalize(text) {
    return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).map(singular).join(" ");
  }

  // Same mapping as apply_aliases() in scripts/build_data.py, which ships the table.
  const ALIAS_ORDER = Object.keys(D.aliases).sort((a, b) => b.length - a.length);
  function applyAliases(norm) {
    let s = ` ${norm} `;
    for (let pass = 0; pass < 3; pass++) {
      const before = s;
      ALIAS_ORDER.forEach((a) => (s = s.split(` ${a} `).join(` ${D.aliases[a]} `)));
      if (s === before) break;
    }
    return s.trim();
  }

  // Trailing words that describe a part or form of the item rather than a different item.
  const PART_WORDS = new Set(["clove", "leaf", "sprig", "juice", "zest", "wedge", "slice", "piece", "chunk", "half", "floret", "stalk", "rib", "spear", "head", "bulb", "kernel", "segment", "ring", "strip", "cube", "dice"]);

  function headWord(words) {
    let end = words.length;
    while (end > 1 && PART_WORDS.has(words[end - 1])) end--;
    return words[end - 1];
  }

  // Compounds that are a different food from their main noun: "potato" shouldn't match "sweet potato".
  const DISTINCT = ["sweet potato", "peanut butter", "almond butter", "cashew butter", "nut butter", "sunflower butter",
    "apple butter", "pumpkin butter", "cookie butter", "cocoa butter", "coconut milk",
    "almond milk", "soy milk", "rice milk", "oat milk", "coconut cream", "ice cream", "cream cheese", "green bean"];

  // Word-level containment either way, but the main noun must agree:
  // "tomato" matches "cherry tomato" and "garlic" matches "garlic clove", but "tomato" doesn't match "tomato paste".
  function matches(owned, needed) {
    const a = ` ${owned} `;
    const b = ` ${needed} `;
    if (!a.includes(b) && !b.includes(a)) return false;
    if (DISTINCT.some((d) => a.includes(` ${d} `) !== b.includes(` ${d} `))) return false;
    return headWord(owned.split(" ")) === headWord(needed.split(" "));
  }

  // --- Data ---
  const vocab = D.vocab;
  const vocabSet = new Set(vocab);
  const pantry = new Set(D.pantry);
  const vocabHead = vocab.map((v) => headWord(v.split(" ")));
  const byHead = new Map();
  vocabHead.forEach((h, i) => byHead.set(h, [...(byHead.get(h) || []), i]));
  // matches() needs the main nouns to agree, so only same-head vocab entries can match.
  const vocabMatching = (item) => (byHead.get(headWord(item.split(" "))) || []).filter((i) => matches(item, vocab[i]));

  // Typed text -> the data's spelling: "garbanzo beans" -> "chickpea", "sweet corn" -> "sweetcorn" if that's the one used.
  const unspaced = new Map();
  vocab.forEach((v) => { if (!unspaced.has(v.replace(/ /g, ""))) unspaced.set(v.replace(/ /g, ""), v); });
  function toIngredient(text) {
    const n = applyAliases(normalize(text));
    return vocabSet.has(n) ? n : unspaced.get(n.replace(/ /g, "")) || n;
  }

  // group = near-duplicate name group; pop = how many recipes share the dish type (popularity proxy).
  const recipes = D.recipes.map(([name, minutes, vegan, course, nut, ings, group, pop], id) => ({
    id, name, minutes, vegan: !!vegan, course, nut, ings, group, pop,
    key: ings.filter((i) => !pantry.has(i)),
    nameLower: name.toLowerCase(),
  }));
  const POPULAR_AT = 50;

  // Two recipes are versions of one dish if their main ingredients nearly coincide, or overlap a lot and the
  // names share words ("Angel Hair with Tomato and Basil" vs "Capellini with Tomatoes, Garlic and Basil").
  // Main nouns, so "garlic clove" = "garlic" and "roma tomato" = "tomato".
  const SAME_INGREDIENTS = 0.75;
  const SIMILAR_INGREDIENTS = 0.5;
  const SIMILAR_NAME = 0.3;
  const NAME_FILLER = new Set(normalize(
    "the and with for easy best ever quick simple yummy delicious healthy homemade classic fresh style recipe version low fat free light super",
  ).split(" "));
  function signature(r) {
    r.sig ||= {
      heads: [...new Set(r.key.map((i) => vocabHead[i]))],
      words: [...new Set(normalize(r.name).split(" ").filter((w) => w.length > 2 && !NAME_FILLER.has(w)))],
    };
    return r.sig;
  }
  // A recipe's main ingredients are the ones it's named after ("Stuffed Potatoes" -> potato), directly or through
  // a dish built on them ("Hummus" -> chickpea). For heads like "cheese" or "sauce" the modifier counts too
  // ("feta cheese" is main in "Spinach Feta Pie"), but adjectives don't ("black bean" isn't main in "Black Rice").
  // Vague heads only count through their modifier: "soy sauce" isn't main in "Tomato Sauce".
  const DISH_WORDS = {
    hummus: "chickpea", falafel: "chickpea", chana: "chickpea", chole: "chickpea", guacamole: "avocado", pesto: "basil",
    dal: "lentil", dhal: "lentil", daal: "lentil", salsa: "tomato", marinara: "tomato", gazpacho: "tomato",
    bruschetta: "tomato", caprese: "tomato mozzarella basil", shakshuka: "egg tomato", omelet: "egg", omelette: "egg",
    frittata: "egg", quiche: "egg", coleslaw: "cabbage", slaw: "cabbage", sauerkraut: "cabbage", kimchi: "cabbage",
    latke: "potato", gnocchi: "potato", hash: "potato", rosti: "potato", aloo: "potato", gobi: "cauliflower",
    palak: "spinach", saag: "spinach", baingan: "eggplant", bhindi: "okra", matar: "pea", mutter: "pea",
    ratatouille: "eggplant zucchini", ghanoush: "eggplant", moussaka: "eggplant", tabbouleh: "bulgur parsley",
    tabouli: "bulgur parsley", risotto: "rice", pilaf: "rice", biryani: "rice", paella: "rice", applesauce: "apple",
    cornbread: "cornmeal", mac: "macaroni", lasagna: "noodle",
    pasta: "spaghetti penne linguine fettuccine fettuccini macaroni rotini farfalle fusilli rigatoni ziti orzo capellini noodle",
  };
  const VAGUE_HEADS = new Set(["sauce", "powder", "seasoning", "mix", "extract", "paste", "oil", "vinegar", "broth", "stock", "spice", "flake", "seed", "chip", "crumb", "syrup"]);
  const MODIFIED_HEADS = new Set([...VAGUE_HEADS, "cheese", "bean", "pepper", "milk", "flour", "nut", "cream", "yogurt", "noodle", "butter", "lentil", "pea", "rice", "squash"]);
  const ADJECTIVES = new Set(normalize(
    "black red green white yellow orange brown golden fresh dried dry ground frozen sweet hot mild large small baby whole " +
    "light dark low fat free plain sharp sea wild raw cooked canned extra virgin unsalted salted shredded grated sliced chopped",
  ).split(" "));
  function mainIds(r) {
    if (!r.main) {
      const words = new Set(applyAliases(normalize(r.name)).split(" "));
      [...words].forEach((w) => DISH_WORDS[w]?.split(" ").forEach((x) => words.add(x)));
      r.main = new Set(r.key.filter((i) => {
        const head = vocabHead[i];
        if (words.has(head) && !VAGUE_HEADS.has(head)) return true;
        return MODIFIED_HEADS.has(head) && vocab[i].split(" ").some((w) => w !== head && !ADJECTIVES.has(w) && words.has(w));
      }));
    }
    return r.main;
  }

  function similar(a, b) {
    const x = signature(a);
    const y = signature(b);
    const ings = jaccard(x.heads, y.heads);
    return ings >= SAME_INGREDIENTS || (ings >= SIMILAR_INGREDIENTS && jaccard(x.words, y.words) >= SIMILAR_NAME);
  }

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const form = $("prefs");
  const input = $("ingredient-input");
  const chipsEl = $("chips");
  const timeEl = $("time");
  const resultsEl = $("results");
  const summaryEl = $("summary");
  const moreBtn = $("more");
  const template = $("card-template");

  const have = new Set();
  let ownedIds = new Set();
  let chipIds = [];
  let ranked = [];
  let cursor = 0;
  let kept = [];
  let keptGroups = new Set();
  let groupCounts = new Map();

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    children.forEach((c) => node.append(c));
    return node;
  }

  function addIngredient(raw) {
    raw.split(",").map(toIngredient).filter(Boolean).forEach((i) => have.add(i));
    onIngredientsChanged();
  }

  function onIngredientsChanged() {
    chipIds = [...have].map((h) => new Set(vocabMatching(h)));
    ownedIds = new Set(chipIds.flatMap((s) => [...s]));
    chipsEl.replaceChildren(...[...have].map((item) => el("li", { textContent: item }, [
      el("button", { type: "button", textContent: "×", ariaLabel: `Remove ${item}`, onclick: () => { have.delete(item); onIngredientsChanged(); } }),
    ])));
    document.querySelectorAll("#categories button").forEach((b) => b.classList.toggle("on", have.has(b.dataset.item)));
  }

  function readPrefs() {
    const course = $("course").value;
    return {
      time: Number(timeEl.value) >= 180 ? Infinity : Number(timeEl.value),
      goals: [...form.querySelectorAll('input[name="goal"]:checked')].map((i) => i.value),
      vegan: form.querySelector('input[name="diet"]:checked').value === "vegan",
      course: course === "all" ? null : Number(course),
      maxMissing: Number($("missing").value),
      sort: $("sort").value,
      hideSimilar: $("hide-similar").checked,
    };
  }

  // Cheap deterministic shuffle so "no ingredients" results aren't alphabetical.
  const hash = (n, seed) => (Math.imul(n ^ seed, 2654435761) >>> 0) / 4294967296;

  function suggest(prefs) {
    const seed = (Math.random() * 1e9) | 0;
    const out = [];
    for (const r of recipes) {
      if (r.minutes > prefs.time) continue;
      if (prefs.vegan && !r.vegan) continue;
      if (prefs.course !== null && r.course !== prefs.course) continue;
      if (!prefs.goals.every((g) => GOALS[g].test(r))) continue;
      let fit;
      let owned = 0;
      let used = 0;
      let mains = 0;
      if (have.size) {
        owned = r.key.reduce((n, i) => n + (ownedIds.has(i) ? 1 : 0), 0);
        const missing = r.key.length - owned;
        if (!owned || missing > prefs.maxMissing) continue;
        used = chipIds.reduce((n, ids) => n + (r.key.some((i) => ids.has(i)) ? 1 : 0), 0);
        const main = mainIds(r);
        mains = chipIds.reduce((n, ids) => n + ([...main].some((i) => ids.has(i)) ? 1 : 0), 0);
        fit = (owned / r.key.length) * 20 - missing * 12 - r.minutes / 60;
      } else {
        fit = hash(r.id, seed) * 3;
      }
      const pop = Math.log2(1 + r.pop);
      const value = {
        match: fit + pop * 3,
        popular: pop * 20 + fit * 0.3,
        quick: -r.minutes * 10 + fit * 0.1,
      }[prefs.sort];
      out.push({ r, owned, used, mains, value, hidden: 0 });
    }
    // Recipes built around more of your ingredients come first, then ones using more of them at all;
    // the sort only orders recipes within those tiers.
    return out.sort((a, b) => b.mains - a.mains || b.used - a.used || b.value - a.value);
  }

  function jaccard(a, b) {
    if (!a.length || !b.length) return 0;
    const set = new Set(a);
    const inter = b.reduce((n, i) => n + (set.has(i) ? 1 : 0), 0);
    return inter / (a.length + b.length - inter);
  }

  // Walk the ranked list, skipping recipes that are versions of one already shown.
  function nextPage(prefs) {
    const page = [];
    while (page.length < PAGE_SIZE && cursor < ranked.length) {
      const s = ranked[cursor++];
      if (prefs.hideSimilar && keptGroups.has(s.r.group)) continue;
      const twin = prefs.hideSimilar && kept.find((k) => similar(k.r, s.r));
      if (twin) {
        twin.hidden++;
        twin.showHidden?.();
        continue;
      }
      kept.push(s);
      keptGroups.add(s.r.group);
      page.push(s);
    }
    return page;
  }

  // --- Lazy-loaded steps (plain <script> files so file:// works too) ---
  const shardCache = {};
  const shardWaiters = {};
  window.__recipeSteps = (shard, data) => {
    shardCache[shard] = data;
    (shardWaiters[shard] || []).forEach((w) => w.resolve(data));
    delete shardWaiters[shard];
  };

  function loadShard(shard) {
    if (shardCache[shard]) return Promise.resolve(shardCache[shard]);
    return new Promise((resolve, reject) => {
      const first = !shardWaiters[shard];
      (shardWaiters[shard] ||= []).push({ resolve, reject });
      if (!first) return;
      const s = el("script", { src: `data/steps/${shard}.js` });
      s.onerror = () => { (shardWaiters[shard] || []).forEach((w) => w.reject()); delete shardWaiters[shard]; s.remove(); };
      document.head.append(s);
    });
  }

  const loadSteps = (id) => loadShard(id % D.shards).then((data) => data[id]);

  // --- Pictures ---
  // Free, keyless text-to-image endpoint. Swap for a backend call to OpenAI / Stability / Replicate etc.
  function imageUrlFor(r) {
    const main = r.key.slice(0, 6).map((i) => vocab[i]).join(", ");
    const prompt = `Appetizing overhead food photography of ${r.name}, ${r.vegan ? "vegan" : "vegetarian"} dish made with ${main}, natural light, rustic table, high detail`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=420&nologo=true&seed=${(Math.random() * 1e6) | 0}`;
  }

  function generatePicture(card, r) {
    const img = card.querySelector("img");
    const btn = card.querySelector(".gen-btn");
    btn.disabled = true;
    btn.textContent = "Cooking up a picture…";
    img.onload = () => { img.hidden = false; card.querySelector(".emoji").hidden = true; btn.textContent = "Regenerate"; btn.disabled = false; };
    img.onerror = () => { btn.textContent = "Couldn't generate — try again"; btn.disabled = false; };
    img.alt = r.name;
    img.src = imageUrlFor(r);
  }

  // --- Rendering ---
  const fmt = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  const fmtTime = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);

  function renderCard(s, prefs) {
    const { r, owned } = s;
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".emoji").textContent = (EMOJI.find(([re]) => re.test(r.nameLower)) || [null, "🍽️"])[1];
    card.querySelector(".title").textContent = r.name;
    card.querySelector(".meta").textContent =
      `${fmtTime(r.minutes)} · ${Math.round(amount(r, 0))} kcal · ${fmt(amount(r, 4))} g protein · ${fmt(amount(r, 6))} g carbs`;

    const missing = r.key.filter((i) => !ownedIds.has(i)).map((i) => vocab[i]);
    const main = mainIds(r);
    const around = [...have].filter((_, c) => [...main].some((i) => chipIds[c].has(i)));
    const alsoUses = [...have].filter((h, c) => !around.includes(h) && r.key.some((i) => chipIds[c].has(i)));
    const uses = [around.length && `Built around your ${around.join(", ")}`, alsoUses.length && `${around.length ? "also uses" : "Uses"} your ${alsoUses.join(", ")}`];
    card.querySelector(".match").textContent = have.size
      ? `${uses.filter(Boolean).join(" · ")} · ${owned} of ${r.key.length} ingredients on hand`
      : `${r.key.length} ingredients + pantry staples`;
    card.querySelector(".missing").textContent = have.size && missing.length ? `Need to grab: ${missing.join(", ")}` : "";
    const similarEl = card.querySelector(".similar");
    s.showHidden = () => {
      const versions = prefs.hideSimilar ? (groupCounts.get(r.group) || 1) - 1 + s.hidden : 0;
      similarEl.textContent = versions ? `+${versions} similar version${versions > 1 ? "s" : ""} hidden` : "";
    };
    s.showHidden();

    const badges = card.querySelector(".badges");
    if (r.pop >= POPULAR_AT) {
      badges.append(el("li", { textContent: "Popular dish", className: "popular", title: `${r.pop} Food.com recipes for this kind of dish` }));
    }
    badges.append(el("li", { textContent: r.vegan ? "Vegan" : "Vegetarian", className: "diet" }));
    Object.entries(GOALS).forEach(([key, g]) => {
      if (g.test(r)) badges.append(el("li", { textContent: g.label, className: prefs.goals.includes(key) ? "hit" : "" }));
    });

    card.querySelector(".ingredients").append(...r.ings.map((i) => {
      const status = pantry.has(i) ? "pantry" : ownedIds.has(i) ? "have" : have.size ? "need" : "";
      return el("li", { textContent: vocab[i], className: status, title: { pantry: "Pantry staple", have: "You have this", need: "You'd need this" }[status] || "" });
    }));

    card.querySelector(".nutrition tbody").append(...NUTRIENTS.map((n) => el("tr", {}, [
      el("th", { textContent: n.label }),
      el("td", { textContent: `${n.i === 0 ? Math.round(amount(r, 0)) : `≈ ${fmt(amount(r, n.i))}`} ${n.unit}` }),
      el("td", { className: "dv", textContent: n.dv ? `${r.nut[n.i]}% DV` : "" }),
    ])));

    const details = card.querySelector("details");
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.loaded) return;
      details.dataset.loaded = "1";
      const steps = card.querySelector(".steps");
      loadSteps(r.id).then(([desc, list]) => {
        card.querySelector(".desc").textContent = desc;
        steps.replaceChildren(...list.map((t) => el("li", { textContent: t })));
      }).catch(() => {
        delete details.dataset.loaded;
        steps.replaceChildren(el("li", { className: "loading", textContent: "Couldn't load steps — close and reopen to retry." }));
      });
    });

    card.querySelector(".gen-btn").onclick = () => generatePicture(card, r);
    return card;
  }

  const aboutCard = $("about-template").content.firstElementChild.cloneNode(true);

  // New recipes go in before "Load more" and the about card, which always stay last.
  function renderPage(prefs) {
    resultsEl.append(...nextPage(prefs).map((s) => renderCard(s, prefs)), moreBtn, aboutCard);
    moreBtn.hidden = cursor >= ranked.length;
    moreBtn.onclick = () => renderPage(prefs);
  }

  function run() {
    if (input.value.trim()) { addIngredient(input.value); input.value = ""; }
    const prefs = readPrefs();
    ranked = suggest(prefs);
    cursor = 0;
    kept = [];
    keptGroups = new Set();
    groupCounts = new Map();
    ranked.forEach(({ r }) => groupCounts.set(r.group, (groupCounts.get(r.group) || 0) + 1));
    resultsEl.replaceChildren();
    if (!ranked.length) {
      summaryEl.textContent = "No matches. Try more time, fewer goals, a different course, or allowing a few extra items.";
      moreBtn.hidden = true;
      return;
    }
    const n = ranked.length.toLocaleString();
    const built = ranked.filter((s) => s.mains).length;
    const picks = have.size > 1 ? "your ingredients" : `your ${[...have][0]}`;
    const lead = built
      ? ` ${built.toLocaleString()} ${built > 1 ? "are" : "is"} built around ${picks}, and ${built > 1 ? "they come" : "it comes"} first.`
      : ` None are built around ${picks}, so recipes using ${have.size > 1 ? "the most of them" : "it"} come first.`;
    summaryEl.textContent = have.size
      ? `${n} recipe${ranked.length > 1 ? "s" : ""} match.${lead}`
      : `${n} recipes fit your filters — here's a random selection. Add ingredients to get matched suggestions.`;
    renderPage(prefs);
  }

  // --- Setup ---
  function setup() {
    const total = recipes.length.toLocaleString();
    const vegan = recipes.filter((r) => r.vegan).length.toLocaleString();
    $("dataset-stats").textContent = `Searching ${total} recipes (${vegan} vegan) and ${vocab.length.toLocaleString()} ingredients`;

    $("ingredient-options").append(
      ...vocab.filter((v, i) => !pantry.has(i)).slice(0, AUTOCOMPLETE_SIZE).map((v) => el("option", { value: v })),
    );

    const uses = new Array(vocab.length).fill(0);
    recipes.forEach((r) => r.ings.forEach((i) => uses[i]++));
    // Only narrower versions count: "basil" gets "fresh basil" recipes, but "almond butter" doesn't get "butter" ones.
    const covers = (item, v) => ` ${v} `.includes(` ${item} `);
    const popularity = (item) => vocabMatching(item).reduce((n, i) => n + (covers(item, vocab[i]) ? uses[i] : 0), 0);

    // The most-used items show first; one already covered by a shown item ("basil" covers "fresh basil") waits in "more".
    function rankCategory(items) {
      const top = [];
      const rest = [];
      items.filter((i) => vocabSet.has(i))
        .map((item) => ({ item, n: popularity(item) }))
        .sort((a, b) => b.n - a.n)
        .forEach(({ item }) => (top.length < TOP_PER_CATEGORY && !top.some((t) => covers(t, item)) ? top : rest).push(item));
      return { top, rest };
    }

    const toggleItem = (item) => { have.has(item) ? have.delete(item) : have.add(item); onIngredientsChanged(); };
    const chip = (item, extra) => {
      const b = el("button", { type: "button", textContent: item, className: extra ? "extra" : "", onclick: () => toggleItem(item) });
      b.dataset.item = item;
      return b;
    };
    $("categories").append(...Object.entries(CATEGORIES).map(([title, items]) => {
      const { top, rest } = rankCategory(items);
      const box = el("div", { className: "category" });
      const more = el("button", { type: "button", className: "more", textContent: "more…", onclick: () => {
        more.textContent = box.classList.toggle("open") ? "less" : "more…";
      } });
      box.append(el("h4", { textContent: title }), el("div", {}, [
        ...top.map((item) => chip(item, false)), ...rest.map((item) => chip(item, true)), ...(rest.length ? [more] : []),
      ]));
      return box;
    }));

    $("goals").append(...Object.entries(GOALS).map(([key, g]) => el("label", { title: g.hint }, [
      el("input", { type: "checkbox", name: "goal", value: key }), ` ${g.label} `, el("small", { textContent: g.hint }),
    ])));

    input.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === ",") && input.value.trim()) {
        e.preventDefault();
        addIngredient(input.value);
        input.value = "";
      } else if (e.key === "Backspace" && !input.value && have.size) {
        have.delete([...have].pop());
        onIngredientsChanged();
      }
    });
    // Picking from the autocomplete list fires "input" without a typing inputType.
    input.addEventListener("input", (e) => {
      if ((!e.inputType || e.inputType === "insertReplacementText") && vocabSet.has(toIngredient(input.value))) {
        addIngredient(input.value);
        input.value = "";
      }
    });
    $("chip-box").addEventListener("click", (e) => { if (e.target.id === "chip-box" || e.target.id === "chips") input.focus(); });
    $("clear").onclick = () => { have.clear(); onIngredientsChanged(); };
    timeEl.addEventListener("input", () => {
      $("time-out").textContent = Number(timeEl.value) >= 180 ? "any amount of time" : fmtTime(Number(timeEl.value));
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  }

  setup();
})();

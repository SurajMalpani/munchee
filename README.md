# Munchee: What Should I Eat?

A static webpage that suggests vegetarian and vegan recipes from the ingredients you have, the time you've got, and the nutrition you want. Sister app of [Drinkee](../drinkee/).

Open `index.html` in a browser. No server, build step, or API key is needed (the data files are plain `.js` so they also work from `file://`).

## Features

- **34,466 recipes** (7,932 vegan) and ~6,700 ingredients from the Food.com dataset, after dropping 8,543 near-duplicate re-posts (see below).
- **Ingredient input** with autocomplete (top 2,500 ingredients) and a "Browse ingredients" panel in 9 groups. Each group shows its 7 most-used ingredients (by how many recipes use them, skipping ones a shown item already covers, like "fresh basil" under "basil"). "more…" reveals the rest of the ~170 picks, and selected ones stay visible.
- **Smart matching**: handles plurals and forms ("garlic clove" counts as garlic, "cherry tomato" as tomato) but won't treat "tomato paste" as fresh tomato. Compounds that are a different food stay separate: potato doesn't match sweet potato, butter doesn't match peanut butter, and milk doesn't match coconut milk (`DISTINCT` in `js/app.js`). Pantry staples (salt, oil, water, sugar, flour…) are assumed.
- **One name per ingredient**: regional names, alternate spellings and typos map to one form, in the data and in what you type. For example, panir and paneer cheese become paneer, garbanzo beans become chickpea, scallion and spring onion become green onion, aubergine becomes eggplant, yoghurt becomes yogurt, and jalapeño becomes jalapeno. Spacing variants ("sweetcorn" / "sweet corn") merge into the more common one automatically. The alias table is `ALIASES` in `build_data.py`, and the build ships it to the page. It's hand-picked because automatic near-spelling merges in this data are mostly wrong (spiced/sliced, besan/bean, morel/morsel).
- **Filters**: diet (vegetarian incl. vegan / vegan only), time (5 min to any), course (meals & snacks, desserts, drinks, sauces, everything), and how many missing items you're OK buying.
- **Nutrition goals** (per serving, strict filters): high protein (≥ 20 g), low carb (≤ 30 g), low calorie (≤ 400 kcal), low sugar (≤ 10 g), low fat (≤ 15 g), low sodium (≤ 600 mg).
- **Ranking** (same idea as Drinkee's base spirit): recipes built around more of your ingredients come first, then ones that use more of them at all. Within those tiers, the sort decides: best match (fewer items to buy, plus a boost for popular dishes), popular dishes first, or quickest first. So with tomato picked, tomato soup and broiled tomatoes come before stuffed potatoes with a tomato on the side. Each card says "Built around your tomato · also uses your garlic".
- **Main ingredients** are inferred from the recipe name, since the data has no quantities. An ingredient is main if the recipe is named after it ("Stuffed Potatoes" means potato), or after a dish built on it ("Hummus" means chickpea, "Palak Paneer" means spinach, "Pasta" means spaghetti, penne and so on; see `DISH_WORDS` in `js/app.js`). For heads like cheese, bean or sauce, the modifier counts too ("feta cheese" is main in "Spinach Feta Pie"), but adjectives don't, and vague heads only count through their modifier ("soy sauce" isn't main in "Tomato Sauce"). With no ingredients you get a popularity-weighted random selection.
- **Popularity** is a proxy: how many Food.com recipes share the dish type (the last two meaningful name words, e.g. "Creamy Roasted Tomato Soup" counts as "tomato soup"). Dishes with 50+ versions get a "Popular dish" badge. Real ratings live in Kaggle's `RAW_interactions.csv`, but the mirror has no recipe ids to join on.
- **Hide similar recipes** (on by default): skips a recipe if its name reduces to the same dish as one already shown ("Easy Tomato Soup", "Mom's Tomato Soup II"). It also skips recipes whose main ingredients overlap ≥ 75% with a shown one, or ≥ 50% when the names also share words ("Angel Hair with Tomato and Basil" vs "Capellini with Tomatoes, Garlic and Basil"). Ingredients are compared by main noun, so "garlic clove" = "garlic" and "roma tomato" = "tomato". Cards show how many similar versions were hidden.
- **5 recipes at a time**, with **Load more** for the next 5.
- **Recipe details**: description, ingredients marked have / need / pantry, a nutrition table (calories, protein, carbs, sugar, fat, saturated fat, sodium in grams and % daily value), and steps.
- **Generate picture** button per recipe (see below).

## Project layout

```
index.html            page markup and card template
styles.css            styles
js/app.js             matching, ranking, rendering, lazy step loading
scripts/build_data.py builds data/ from the Food.com dataset
data/recipes-index.js recipe index loaded up front (~3.4 MB)
data/steps/*.js       descriptions + steps, loaded when a recipe is opened (230 files, ~24 MB)
data/raw/             downloaded source files (git-ignored)
```

## Rebuilding the data

From this folder:

```bash
uv run --with pandas --with pyarrow --with fsspec --with aiohttp --with truststore \
  python scripts/build_data.py --fetch
```

`--fetch` downloads only the needed columns of the 11 source shards (~4 MB of each 17 MB file) into `data/raw/`. Omit it to rebuild from the cache, e.g. after editing the diet or course rules. `truststore` makes Python trust the OS certificate store, which is needed behind TLS-inspecting corporate proxies.

The build drops near-duplicate recipes: a recipe goes if a better one (more popular dish type, has a description, more detailed steps) shares ≥ 75% of its main ingredients and has similar steps (weighted step-word overlap ≥ 0.1). Both comparisons weight items by rarity, so sharing avocado and tomatillo counts far more than sharing butter and egg, and "mash" or "griddle" far more than "add" or "stir". Without the weighting, every butter-egg-vanilla bake looks like a copy of every other. Tune `SAME_INGREDIENTS` and `SAME_STEPS` in `build_data.py`: 0.8 and 0.1 keep ~37,000 recipes, and 0.75 and 0.15 keep ~37,500.

The script keeps the normalization rules in sync with `normalize()` in `js/app.js`; change both together.

## Data source and caveats

- **Source**: Food.com recipes (Majumder et al., 2019, Kaggle ["Food.com Recipes and User Interactions"](https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions)), via the Hugging Face mirror [`KingName1/food.com`](https://huggingface.co/datasets/KingName1/food.com). Intended for personal / research use.
- **Partial coverage**: the mirror only has recipe names "0" to "F" (~88k of 231k). To cover everything, download the full `RAW_recipes.csv` from Kaggle (needs a Kaggle API token) and adapt `build_data.py`.
- **Diet labels are inferred** from ingredients and steps, since the mirror has no tags. Obvious cases are handled (plurals, fish names, meat substitutes, cheese mentioned only in steps), but some mistakes can slip through. Double-check if you're strict.
- **Nutrition** is per serving as reported by Food.com. Grams are approximate, converted from % daily value (protein 50 g, carbs 300 g, sugar 50 g, fat 65 g, saturated fat 20 g, sodium 2,400 mg). The dataset has no fiber.

Other datasets considered: [`datahiveai/recipes-with-nutrition`](https://huggingface.co/datasets/datahiveai/recipes-with-nutrition) has great nutrition, diet labels and photos but no cooking time or steps. The Food.com "Recipes and Reviews" mirrors on Hugging Face are truncated (~1,200 intact rows).

## Recipe pictures

The button uses [Pollinations](https://pollinations.ai), a free text-to-image service with no key: the prompt goes in the image URL. It's handy for demos but unreliable (it returned HTTP 503 during testing). If it fails, the card keeps its emoji placeholder.

For dependable images:

1. Pick a paid service: OpenAI image models, Stability AI, Replicate (e.g. Flux), or Cloudflare Workers AI. Roughly a few cents per image.
2. Add a small backend (e.g. a Cloudflare Worker) to hold the API key, since keys can't live in a public page.
3. Cache each generated image (e.g. in Cloudflare R2) so you pay once per dish.
4. Point `imageUrlFor()` in `js/app.js` at your backend.

## Ideas for later

- Use the full Kaggle dataset, plus `RAW_interactions.csv` for ratings.
- Let a language model (GPT, Claude) adapt recipes to exactly what you have, via the same backend.
- Save favourites and a shopping list in `localStorage`.

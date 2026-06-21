/* Nine Lives Co. — tailwind.config.js. Thin: all tokens come from the Necromancy
   preset. `content` scans the rendered page + the framework partials so every
   utility and component class that ships is kept, unused ones tree-shaken. */
module.exports = {
  presets: [require("@ninelives/necromancy/preset")],
  content: [
    "./dist/**/*.html",
    "./templates/**/*.hbs",
    "../../packages/necromancy/hbs/**/*.hbs",
  ],
  theme: { extend: {} },
  plugins: [],
};

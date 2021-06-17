module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: 'eslint:recommended',
  rules: {
    indent: ['off', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['warn', 'single'],
    semi: ['warn', 'always'],
    'no-console': 0,
    'no-unused-vars': 1,
    'no-empty': 1,
    'no-inner-declarations': 1,

    'generator-star-spacing': 1,
    'array-bracket-spacing': 1,
    'object-shorthand': 1,
    'arrow-parens': 1,
    'no-await-in-loop': 1,
  },
  overrides: [
    {
      files: ['*.test.js'],
      env: {
        mocha: true,
      },
    },
  ],
};

const { EveryPluginDevServer } = require('every-plugin/build/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

module.exports = withZephyr({
  hooks: {
    onDeployComplete: (info) => {
      console.log('🚀 Deployed:', info.url);
    },
  },
})({
  plugins: [new EveryPluginDevServer()]
});
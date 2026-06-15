const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Follow symlinks so pnpm hoisted workspace packages resolve correctly
config.resolver.unstable_enableSymlinks = true;

// Explicitly map workspace packages to their source — bypasses symlink issues on Vercel
config.resolver.extraNodeModules = {
  '@talentbank/firebase-config': path.resolve(workspaceRoot, 'packages', 'firebase-config', 'src'),
  '@talentbank/shared': path.resolve(workspaceRoot, 'packages', 'shared', 'src'),
};

// Resolve modules from workspace root node_modules too
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force React and React-Native to resolve from the mobile app only.
// pnpm monorepo has react@19.0.0 (mobile) and react@19.2.4 (web) in the
// same store; without this, Metro may bundle both and trigger the
// "Invalid hook call" duplicate-React error.
const singletonModules = ['react', 'react-dom', 'react-native'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = singletonModules.find(
    (m) => moduleName === m || moduleName.startsWith(m + '/')
  );
  if (base) {
    const suffix = moduleName.slice(base.length);
    const resolved = require.resolve(base + suffix, {
      paths: [path.resolve(projectRoot, 'node_modules')],
    });
    return { filePath: resolved, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

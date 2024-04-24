/** @type {import('@remix-run/dev').AppConfig} */
export default {
	devServerBroadcastDelay: 1000,
	ignoredRouteFiles: ['**/.*'],
	server: './party/index.ts',
	serverConditions: ['partykit', 'workerd', 'worker', 'browser'],
	//serverDependenciesToBundle: [/^(?!__STATIC_CONTENT_MANIFEST).*$/],
	serverMainFields: ['browser', 'module', 'main'],
	serverMinify: false,
	serverModuleFormat: 'esm',
	serverPlatform: 'neutral',
	tailwind: true,
	postcss: true,
	dev: {
		port: 8002,
	},
	// appDirectory: "app",
	// assetsBuildDirectory: "public/build",
	// serverBuildPath: "build/index.js",
	// publicPath: "/build/",
}

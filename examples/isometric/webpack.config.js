const path = require('path');

module.exports = {
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.md']
    },
    devtool: 'inline-source-map',
    entry: './src/index.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/'
    },
    mode: 'development',
    module: {
        rules: [
            { test: /\.ts$/, loader: 'ts-loader' },
            { test: /\.svg$/, loader: 'raw-loader' },
            { test: /\.md$/, type: 'asset/source' },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            }
        ]
    },
    devServer: {
        static: {
            directory: __dirname,
            // Skip noisy paths: dist/ is rewritten by webpack on every build (would
            // trigger an endless reload loop), node_modules/ contains ~10k+ files
            // and churns whenever the system indexes it.
            watch: {
                ignored: ['**/node_modules/**', '**/dist/**'],
            },
        },
        compress: true
    },
};

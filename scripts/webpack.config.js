/** @format */

const path = require("path");
const fs = require("fs");
// const zlib = require("zlib");
// const zopfli = reuire("zopfli");
// const CompressionPlugin = require("compression-webpack-plugin");
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const { program } = require("commander");

const options = program
  .option("-w", "webpack watch options.")
  .option("--progress")
  .option("--config <config>", "webpack config file.")
  .option("--env <env>", "environment variables, splited with a comma(,).")
  .parse(process.argv)
  .opts();
const envs = (options.env && options.env.split(",")) || [];
const needReport = envs.includes("report");

const ROOT_PATH = path.resolve(__dirname, "../");
const SRC_PATH = path.resolve(ROOT_PATH, "src");
const DIST_PATH = path.resolve(ROOT_PATH, "build");

const baseConfig = {
  entry: {
    index: path.join(SRC_PATH, "index.ts"),
  },

  output: {
    path: DIST_PATH,
  },

  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx"],
    alias: {
      "@": SRC_PATH,
    },
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                declaration: true,
                declarationMap: true,
                rootDir: SRC_PATH,
                declarationDir: DIST_PATH,
                outDir: DIST_PATH,
              },
            },
          },
        ],
      },
    ],
  },

  plugins: [
    // 将 process.env 中所有环境变量迁移进来
    new webpack.DefinePlugin(
      Object.keys(process.env).reduce((env, key) => {
        env[`process.env.${key}`] = JSON.stringify(process.env[key]);
        return env;
      }, {})
    ),
  ],
};

module.exports = [
  // ESM 模块
  {
    ...baseConfig,

    mode: "development",
    devtool: "source-map",

    externals: {
      react: "react",
      "react-dom": "react-dom",
      "react-redux": "react-redux",
      "rect-router-dom": "react-router-dom",
      redux: "redux",
    },

    experiments: {
      outputModule: true,
    },

    output: {
      ...baseConfig.output,
      filename: "[name].mjs",
      library: {
        type: "module",
      },
    },

    plugins: [
      new CleanWebpackPlugin(),
      ...(needReport
        ? [
            new BundleAnalyzerPlugin({
              analyzerMode: "static",
              openAnalyzer: false,
              reportFilename: "report.esm.html",
            }),
          ]
        : []),
    ],
  },
];

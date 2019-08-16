# serverless-sucrase

> Lightweight, blazing-fast transpilation for Serverless projects

## Why not Webpack?

Webpack was designed to output a single bundle containing your application's dependencies. This offers many
advantages to applications targeting runtimes without module systems, but it is largely unnecessary for serverless
runtimes, such as AWS Lambda. In addition, bundling burdens developers with a few issues:

* **Bundling can be slow.** Especially if you're bundling `node_modules` or packaging functions individually, having
  Webpack process your files can end up being a huge bottleneck. Particularly on larger services, an unoptimized
  preprocessing step can easily take up over half of your deployment time.
* **Debugging is much more cumbersome.** Since Webpack bundles all of your application's code into a single file,
  it can be difficult to trace code and prototype changes in inline function editors. Since serverless-sucrase doesn't
  touch your application's structure, you can easily navigate through your code and make quick changes.

## Installation

Install serverless-sucrase and sucrase from npm:

```
npm install --dev serverless-sucrase sucrase
```

Then add serverless-sucrase to your plugins:

```yaml
plugins:
  - serverless-sucrase
```

Since serverless-sucrase is not a bundler, it is recommended you use a plugin like
[serverless-layers](https://github.com/agutoli/serverless-layers) for your `node_modules` dependencies.

## Configuration

The configuration for serverless-sucrase supports all [Sucrase](https://github.com/alangpierce/sucrase) options.
A `sources` array of globs is also exposed if you want to configure an alternate sources path.

```yaml
custom:
  sucrase:
    sources:
      - src/**/*.js
    transforms:
      - imports
```

## Commonly Asked Questions

### How do I configure absolute imports?

Since sucrase is not a bundler, it cannot resolve arbitrary custom module paths. Since serverless functions are run
inside a Node.js environment, you can instead configure your functions to run with a custom `NODE_PATH`.

const path = require("path")
const fs = require("fs-extra")
const globby = require("globby")
const { transform } = require("sucrase")

class ServerlessSucrase {
  constructor(serverless, options) {
    this.serverlessFolder = ".serverless"
    this.buildFolder = ".sucrase"
    this.servicePath = serverless.config.servicePath
    this.buildPath = path.join(this.servicePath, this.buildFolder)

    this.serverless = serverless
    this.options = options

    this.hooks = {
      "before:package:createDeploymentArtifacts": this.compile.bind(this),
      // "after:package:createDeploymentArtifacts": this.cleanup.bind(this),
      "before:deploy:function:packageFunction": this.compile.bind(this),
      "after:deploy:finalize": this.cleanup.bind(this)
    }
  }

  log(msg) {
    this.serverless.cli.log(`[Sucrase]: ${msg}`)
  }

  async compile() {
    const { custom, package: { include = [] }, functions } = this.serverless.service
    const {
      sucrase: { sources = ["src/**/*.js"], ...restOptions } = {}
    } = custom

    const sucraseOptions = {
      transform: ["imports"],
      ...restOptions
    }

    this.log(
      `Transpiling sources matching ${JSON.stringify(
        sources
      )} using configuration ${JSON.stringify(sucraseOptions)}`
    )

    const files = await globby(sources)
    const includeFiles = [...new Set(await globby([
      ...include,
      ...Object.keys(functions).filter(key => functions[key].package).reduce(
        (a,key) => [...a,...functions[key].package.includes], []
      )
    ]))]

    for (const file of [...files, ...includeFiles]) {
      const originalCode = (await fs.readFile(file)).toString()

      let transformedCode;
      if (includeFiles.includes(file)) transformedCode = originalCode
      else transformedCode = transform(originalCode, {
        transforms: ["imports"],
        ...restOptions
      }).code

      const filePath = path.join(this.buildPath, file)
      this.log(`${file} -> ${path.relative(this.servicePath, filePath)}`)
      await fs.outputFile(filePath, transformedCode)
    }

    // change serverless service path to our built files
    this.serverless.config.servicePath = this.buildPath
  }

  async cleanup() {
    this.log('Cleaning up Sucrase')
    // copy built files to original service path
    await fs.copy(
      path.join(this.buildPath, this.serverlessFolder),
      path.join(this.servicePath, this.serverlessFolder)
    )
    // restore original service path
    this.serverless.config.servicePath = this.servicePath
    // clear build directory
    await fs.remove(this.buildPath)
  }
}

module.exports = ServerlessSucrase

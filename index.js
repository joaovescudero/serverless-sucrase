const path = require("path")
const fs = require("fs-extra")
const nfs = require("fs")
const globby = require("globby")
const { transform } = require("sucrase")
const _ = require('lodash')
const watch = require('node-watch');

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
      "after:package:createDeploymentArtifacts": this.moveFiles.bind(this),
      "before:deploy:function:packageFunction": this.compile.bind(this),
      "after:deploy:function:packageFunction": this.moveFiles.bind(this),
      "after:deploy:finalize": this.cleanup.bind(this),
      'before:offline:start:init': this.prepareOfflineInvoke.bind(this),
      'before:offline:start': this.prepareOfflineInvoke.bind(this),
      'before:offline:start:end': this.cleanup.bind(this)
    }
  }

  log(msg) {
    this.serverless.cli.log(`[Sucrase]: ${msg}`)
  }

  async compile(silent = false) {
    const { custom, package: { include = [] }, functions } = this.serverless.service
    const {
      sucrase: { sources = ["src/**/*.js"], ...restOptions } = {}
    } = custom

    const sucraseOptions = {
      transform: ["imports"],
      ...restOptions
    }

    if (!silent) this.log(
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
      if (!silent) this.log(`${file} -> ${path.relative(this.servicePath, filePath)}`)
      await fs.outputFile(filePath, transformedCode)
    }
    this.serverless.config.servicePath = this.buildPath
  }

  async cleanup() {
    this.log('Cleaning up Sucrase')
    await fs.remove(this.buildPath)
  }

  async prepareOfflineInvoke() {
    let { sources } = this.serverless.service.custom.sucrase
    await this.compile(true).catch(ex => ex)
    const rootDir = this.serverless.config.servicePath.replace(`/${this.buildFolder}`, '')
    _.set(
      this.serverless,
      'service.custom.serverless-offline.location',
      path.relative(this.serverless.config.servicePath, path.join('.sucrase'))
    )
    sources = sources.map(s => path.join(rootDir, s.split('/')[0]))
    watch(sources, { recursive: true }, (e, f) => {
      this.compile(true).catch(ex => ex)
    })
  }

  async moveFiles() {
    try {
      const folderFiles = await fs.readdirSync(path.join(this.buildPath, '.serverless'))
      this.log(this.buildPath)
      this.log(this.servicePath)
      for await (let f of folderFiles) {
        const oldDir = path.join(this.buildPath, '.serverless', f)
        const newDir = path.join(this.servicePath, '.serverless', f)
        await fs.copy(oldDir, newDir)
      }
      // await fs.remove(path.join(this.buildPath, '.serverless'))
    } catch (ex) {}
  }
}

module.exports = ServerlessSucrase

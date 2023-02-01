const execa = require('execa')
const running = {}
const {readFile, writeFile, stat, mkdir, createWriteStream} = require('fs').promises

setInterval(() => {
  // console.log({running: Object.keys(running)})
  for (const name in running) {
    if (running[name].exitCode != null) {
      delete running[name]
    }
  }
}, 100)

const run = async (command, name, opts = {}) => {
  console.log({run: command, name, opts})

  let r = running[name]

  if (opts.restart && r) {
    r.kill()
    delete running[name]
    r = null
  }

  if (r) {
    console.log('already runnning ' + name)
    return Promise.resolve(r)
  }

  const shell = String(opts.shell || 'bash')
  opts.shell = false
  delete opts.input
  console.log(shell, opts)
  // r  = execa('"""'+command+'"""', [], opts)
  r  = execa(shell, ['-c', `"""${command}"""`], opts)
  .then(console.log)
  .catch(console.error)
  if (name) running[name] = r
  r.stdout.pipe(process.stdout)
  r.stderr.pipe(process.stderr)
  // console.log({running})
  return r
}

const healthcheck = (c, name, wait, opts) => {
 const r = running[name]
 if (r) return Promise.resolve()

 if (c.healthcheck)
    return run(c.healthcheck, `healthcheck ${name}`, opts)
      .catch(e => {
        if (wait) return healthcheck(c, name, wait)
        throw e
      })

  return Promise.reject({})
}

module.exports = {run, healthcheck}

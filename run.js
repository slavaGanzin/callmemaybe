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

  const [shell, ...args] = String(opts.shell || 'bash -c').split(/\s+/)
  opts.shell = false
  delete opts.input
  console.log(shell, opts)
  // r  = execa('"""'+command+'"""', [], opts)
  console.log(shell, args)
  r  = execa(shell, concat(args, [command]), opts)
  if (name) running[name] = r
  r.stdout.pipe(process.stdout)
  r.stderr.pipe(process.stderr)
  // console.log({running})
  return r
}

const healthcheck = (c, name, retry, opts) => {
  const r = running[name]
  if (r)
    return Promise.resolve()

  if (!c.healthcheck)
    return Promise.reject({})

  return run(c.healthcheck, `healthcheck ${name}`, opts)
    .catch(e => {
      if (retry > 0) return wait(100)
        .then(() => healthcheck(c, name, retry-1, opts))
      throw e
    })

}

const user2uid = user => execa(`id -u ${user}`)
const group2gid = group => execa(`id -g ${group}`)

module.exports = {run, healthcheck, user2uid, group2gid}

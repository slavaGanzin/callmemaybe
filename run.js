const execa = require('execa')
const running = {}

setInterval(() => {
  // console.log({running: Object.keys(running)})
  for (const name in running) {
    if (running[name].exitCode != null) {
      delete running[name]
    }
  }
}, 100)

const run = (command, name, opts = {}) => {
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

  r  = execa('bash', ['-c', '"""'+command+'"""'], opts)
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

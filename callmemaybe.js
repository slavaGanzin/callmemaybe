#!/usr/bin/env node

global.config = {}
Error.stackTraceLimit = Infinity

for (const f in require('ramda'))
  global[f] = require('ramda')[f]

const {readFile, writeFile} = require('fs').promises
const dns2 = require('dns2');
const {promisify} = require('util')
const exec = promisify(require('child_process').exec)
const http = require('http')
const daemonizeProcess = require('daemonize-process')
const yaml = require('yaml')
const { program } = require('commander')
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

const run = (command, name, opts) => {
  // console.log({running})

  let r = running[name]

  if (r) {
    // console.log(running[name].killed, running[name].closed)
    if (opts.restart) r.kill()

    console.log('already runnning ' + name)
    return Promise.resolve(r)
  }

  r  = execa('bash', ['-c', command], opts)
  if (name) running[name] = r
  r.stdout.pipe(process.stdout)
  r.stderr.pipe(process.stderr)
  // console.log({running})
  return r
}

const healthcheck = (c, name) => {
 const r = running[name]
 if (r) return Promise.resolve(r)

 if (c.healthcheck)
    return run(c.healthcheck, `healthcheck ${name}`, {cwd: c.folder || '~'})

  return Promise.reject({})
}


const onetimeServer = (title) => {
  let message = ''
  let closed = false
  process.stdin.on("data", data => {
    message += data.toString()
    process.stdout.write(message)
  })
  process.stdin.on('close', () => closed = true)

  try {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.write(`callmemaybe: ${title}\n\n${message}`)
      process.stdin.on("data", data => {
        res.write(data)
      })

      if (closed) setTimeout(() => {
          res.end()
          console.log('one time server down')
          process.exit()
        }, 300)

    }).listen({port: 80, host: '0.0.0.0'}, () => console.log('one time server up'))
  } catch(e) {
    console.error(e)
  }
}

program
  .option('--server')
  .parse()
const options = program.opts();

if (options.server) {
  return onetimeServer('')
}

const pp = x =>
  process.stdout.write(yaml.stringify(x || {}))

const pe = x =>
  process.stderr.write(yaml.stringify(x || {}))

dns2.pp = (x, comment='') => console.log(comment + join('',values(mapObjIndexed((v,k) => `${k} -> ${join(' ', pluck('address',v))}`, groupBy(x => x.name, x.answers)))))

require('./config').then(() => {


const server = dns2.createServer({
  udp: true,
  handle: async (request, send, rinfo) => {
    const response = dns2.Packet.createResponseFromRequest(request);
    const [ question ] = request.questions;
    const c = config[question.name]

    if (c) {
      pp({matched: c})
      response.answers.push({
        name: question.name,
        type: dns2.Packet.TYPE.A,
        class: dns2.Packet.CLASS.IN,
        ttl: 1,
        address: c.ip || '127.0.0.1'
      });

     return await healthcheck(c, question.name)
     .catch(x => run(c.start, question.name, {cwd: c.folder}))
     .catch(({stderr, stdout}) => {
       return run(`/home/vganzin/work/callmemaybe/callmemaybe.js --server`, 'error-server', {input: stderr+stdout})
       // return Promise.resolve()
     }).then(() => {
       dns2.pp(response)
       send(response)
     })
    }

    if (blocklist.has(question.name)) {
      response.answers.push({
        name: question.name,
        type: dns2.Packet.TYPE.A,
        class: dns2.Packet.CLASS.IN,
        ttl: 1,
        address: '0.0.0.0'
      });
      send(response)
      dns2.pp(response, 'blocked: ')
      return
    }

    const resolve = dns2.TCPClient({
      // dns2.getServers()[0]
      dns: pathOr('1.1.1.1', ['settings', 'resolvers', 0], config)
    })
    const { name } = question;
    const lookup = await resolve(question.name)
    response.answers = lookup.answers
    response.header.ancount = lookup.header.ancount
    response.header.arcount = lookup.header.arcount
    response.header.z = lookup.header.z
    response.header.ra = lookup.header.ra
    dns2.pp(response)
    send(response)
  }
})

server.on('request', (request, response, rinfo) => {
  console.log(request.header.id, request.questions[0])
})

.on('requestError', (error) => {
  console.log('Client sent an invalid request', error)
})

.on('listening', () => {
  pp({listening: server.addresses()})
})

.on('close', () => {
  pp('server closed');
})

server.listen(config.settings)
})

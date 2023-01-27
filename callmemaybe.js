#!/usr/bin/env node

global.config = {}
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

const onetimeServer = ({message, title}) => {
  try {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.write(`callmemaybe: ${title}\n\n${message}`)
      res.end()
      setTimeout(() => {
        console.log('one time server down')
        server.close()
      }, 100)
    }).listen({port: 80, host: '0.0.0.0'}, () => console.log('one time server up'))
  } catch(e) {
    console.error(e)
  }
}

program
  .option('--test')
  .parse()
const options = program.opts();

if (options.test) {
  onetimeServer({message: `Hello, is it me you're looking for?`, title: 'test'})
  // daemonizeProcess();
  return
}

const pp = x =>
  process.stdout.write(yaml.stringify(x || {}))

const pe = x =>
  process.stderr.write(yaml.stringify(x || {}))

dns2.pp = (x, comment='') => console.log(comment + join('',values(mapObjIndexed((v,k) => `${k} -> ${join(' ', pluck('address',v))}`, groupBy(x => x.name, x.answers)))))

require('./config').then(() => {

let running = []

const server = dns2.createServer({
  udp: true,
  handle: async (request, send, rinfo) => {
    const response = dns2.Packet.createResponseFromRequest(request);
    const [ question ] = request.questions;
    const c = config[question.name]

    if (c) {
      pp({matched: c, running})
      response.answers.push({
        name: question.name,
        type: dns2.Packet.TYPE.A,
        class: dns2.Packet.CLASS.IN,
        ttl: 1,
        address: c.ip || '127.0.0.1'
      });

     if (includes(question.name, running)) return send(response)
     running.push(question.name)
     setTimeout(() => {
       running = without(question.name, running)
       pp({running})
     }, 1000) //should be healthcheck start interval

     await (c.healthcheck ? exec(c.healthcheck, {cwd: c.folder || '~', stdio: 'inherit'}) : Promise.reject({}))
     .then(({stdout, stderr}) => {
       running.push(question.name)
       send(response)
       pp({healthcheck: 'ok', stdout, stderr})
     })
     .catch(async ({stdout, stderr}) => {
        pp({healthcheck: 'fail', stdout, stderr})
        running = without(question.name, running)
        if (c.start) {
          pp({starting: c.start})

          return await exec(c.start, {cwd: c.folder, stdio: 'inherit'})
          .then(pp)
          .catch(({stderr}) => {
            pp({stderr})
            onetimeServer({message: stderr, title: question.name + ' ' + c.start + ' error'})
          }).then(() => {
            send(response)
          })
        }

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

// server.on('request', (request, response, rinfo) => {
//   console.log(request.header.id, request.questions[0]);
// });

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

#!/usr/bin/env node-dev

let config = {}
for (const f in require('ramda'))
  global[f] = require('ramda')[f]
const {readFile, writeFile} = require('fs').promises
const yaml = require('yaml')
const dns2 = require('dns2');
const {homedir} = require('os')
const {promisify} = require('util')
const exec = promisify(require('child_process').exec)
const http = require('http')
const daemonizeProcess = require('daemonize-process');

const onetimeServer = (message, title) => {
  const server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.write(`callmemaybe: ${title}\n\n${message}`)
    res.end()
    setTimeout(() => {
      console.log('one time server down')
      server.close()
    }, 100)
  }).listen({port: 80, host: '0.0.0.0'}, () => console.log('one time server up'))
}

const { program } = require('commander');

program
  .option('--test')
  .parse()
const options = program.opts();

if (options.test) {
  onetimeServer(`Hello, is it me you're looking for?`, 'test')
  daemonizeProcess();
  return
}

const pp = x =>
  process.stdout.write(yaml.stringify(x || {}))

const pe = x =>
  process.stderr.write(yaml.stringify(x || {}))

dns2.pp = x => console.log(join('',values(mapObjIndexed((v,k) => `${k} -> ${join(' ', pluck('address',v))}`, groupBy(x => x.name, x.answers)))))

const CONFIG_FILES = [`${homedir()}/.config/callmemaybe.yaml`]

const reloadConfig = async () =>
  config = yaml.parse(await readFile(CONFIG_FILES[0], 'utf8'))

Promise.all(CONFIG_FILES.map(x => readFile(x).catch(() =>
  writeFile(x, `settings:
  udp:
    port: 53
    address: 0.0.0.0
    type: "udp4"  #(Must be either "udp4" or "udp6")
  tcp:
    port: 53
    address: 0.0.0.0
    type: "udp4"  #(Must be either "udp4" or "udp6")

# Array of dns resolvers. defaults to system resolvers
  resolvers: ~

#loopback
localhost:
  ip: 127.0.0.1

# Params and default values
# hostname:                     #hostname of your action
#   ip:          127.0.0.1      #what ip hostname resolve to.
#   healthcheck: ~              #any command that checks that project is up, so there is no need to run start command
#   start:       ~              #command that starts your project
#   folder:      ~              #folder where command will be running

#test endpoints. feel free to remove them

test.callmemaybe:
  start: callmemaybe --test
`)
)))
.then(reloadConfig)
.then(() => setInterval(reloadConfig, 1000))
.then(() => {

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
        ttl: 10,
        address: c.ip || '127.0.0.1'
      });

     if (includes(question.name, running)) return send(response)
     running.push(question.name)

     await (c.healthcheck ? exec(c.healthcheck, {cwd: c.folder || '~', stdio: 'inherit'}) : Promise.reject({}))
     // .then(pp)
     .catch(async ({stdout, stderr}) => {
       if (c.start) {
          pp({starting: c.start})
          return await exec(c.start, {cwd: c.folder, stdio: 'inherit'})
          .then(pp)
          .catch(({stderr}) => {
            pp({stderr, running})
            running = without(question.name, running)
            onetimeServer(stderr, question.name + ' ' + c.start + ' error')
          }).then(() => {
            pp({running})
            running = without(question.name, running)
            pp({running})
          })
       }
     })

     return send(response)
    }


    const resolve = dns2.TCPClient({
      dns: config.settings.resolvers[0] || dns2.getServers()[0]
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

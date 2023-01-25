#!/usr/bin/env node-dev

let config = {}
for (const f in require('ramda'))
  global[f] = require('ramda')[f]
const {readFile, writeFile} = require('fs').promises
const notifier = require('node-notifier')
const yaml = require('yaml')
const dns2 = require('dns2');
const {homedir} = require('os')
const {promisify} = require('util')
const exec = promisify(require('child_process').exec)
const http = require('http')

const notify = (message, title='') => notifier.notify({
  title: `callmemaybe${title?': '+title:''}` ,
  message: yaml.stringify(message),
})

const { program } = require('commander');

program
  .option('--test')
  .parse()
const options = program.opts();

if (options.test) {
  notify(`It's alive!`, 'test')
  return
}

const pp = x =>
  process.stdout.write(yaml.stringify(x || {}))

const pe = x =>
  process.stderr.write(yaml.stringify(x || {}))

dns2.pp = x => console.log(join('\n',values(mapObjIndexed((v,k) => `${k} -> ${join(' ', pluck('address',v))}`, groupBy(x => x.name, x.answers)))))

const execPP = (c,o) => {
  pp({c, o})
  return exec(c,o)
}


const CONFIG_FILES = [`${homedir()}/.config/callmemaybe.yaml`]

const reloadConfig = async () =>
  config = yaml.parse(await readFile(CONFIG_FILES[0], 'utf8'))

Promise.all(CONFIG_FILES.map(x => readFile(x).catch(() =>
  writeFile(x, `settings:
# resolvers:
#   - 1.1.1.1
#   - 8.8.8.8
# defaults to system resolvers
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

const server = dns2.createServer({
  udp: true,
  handle: async (request, send, rinfo) => {
    const response = dns2.Packet.createResponseFromRequest(request);
    const [ question ] = request.questions;
    const c = config[question.name]

    pp(c)
    if (c) {
      response.answers.push({
        name: question.name,
        type: dns2.Packet.TYPE.A,
        class: dns2.Packet.CLASS.IN,
        ttl: 10,
        address: c.ip || '127.0.0.1'
      });
     // await (c.healthcheck ? execPP(c.healthcheck, {cwd: c.folder || '~', stdio: 'inherit'}) : Promise.reject({}))
     // .then(pp)
     // .catch(({stdout, stderr}) => {
       if (c.start) {
          execPP(c.start, {cwd: c.folder, stdio: 'inherit'}).then(pp).catch(({stderr}) => notify(stderr, question.name + ' ' + c.start + ' error'))
       }
     // })

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
    // console.log(response, response2)
    // console.log(question, response, rinfo)
    // send(response);
  }
});

// server.on('request', (request, response, rinfo) => {
//   console.log(request.header.id, request.questions[0]);
// });

server.on('requestError', (error) => {
  console.log('Client sent an invalid request', error);
});

server.on('listening', () => {
  pp(server.addresses());
});

server.on('close', () => {
  pp('server closed');
});

server.listen({
  // Optionally specify port, address and/or the family of socket() for udp server:
  udp: {
    port: 53,
    // address: "127.0.0.1",
    address: "0.0.0.0",
    type: "udp4",  // IPv4 or IPv6 (Must be either "udp4" or "udp6")
  },

  // Optionally specify port and/or address for tcp server:
  tcp: {
    port: 53,
    address: "0.0.0.0",
    // address: "127.0.0.1",
  },
});

// eventually
// server.close();

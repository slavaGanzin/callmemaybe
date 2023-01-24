#!/usr/bin/env node-dev

let config = {}
const {readFile, writeFile} = require('fs').promises
const yaml = require('yaml')
const dns2 = require('dns2');
const {homedir} = require('os')
const {exec} = require('child_process')

const CONFIG_FILES = [`${homedir()}/.config/callmemaybe.yaml`]

const reloadConfig = async () =>
  config = yaml.parse(await readFile(CONFIG_FILES[0], 'utf8'))

Promise.all(CONFIG_FILES.map(x => readFile(x).catch(() =>
  writeFile(x, `settings:
  resolvers: ~ # defaults to system resolvers
#   - 1.1.1.1
#   - 8.8.8.8

localhost:
  ip: 127.0.0.1

# hostname:             #hostname of your action
#   ip:                 #what ip hostname resolve to
#   healthcheck:        #any command that checks that project is up and there is no need to run something to start it
#   command:            #command that starts your project
#   folder:             #folder where command will be running
`)
)))
.then(reloadConfig)
.then(() => setInterval(reloadConfig, 1000))

const server = dns2.createServer({
  udp: true,
  handle: async (request, send, rinfo) => {
    //    console.log(request)
    const response = dns2.Packet.createResponseFromRequest(request);
    const [ question ] = request.questions;

    const c = config[question.name]
    console.log(c)
    if (c ) {
      response.answers.push({
        name: question.name,
        type: Packet.TYPE.A,
        class: Packet.CLASS.IN,
        // ttl: 300,
        address: c.ip
      });
     exec(c.healthcheck, {cwd: c.folder, stdio: 'inherit'}, (err, stdout, stderr) => {
       send(response)

       if (err) {
         if (c.command) {
            console.log(exec(c.command, {cwd: c.folder, stdio: 'inherit'}), (err, stdout, stderr) => {
              console.error(err)
            })
         }
       }
      })

      return
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
    console.log(response)
    send(response)
    // console.log(response, response2)
    // console.log(question, response, rinfo)
    // send(response);
  }
});

server.on('request', (request, response, rinfo) => {
  console.log(request.header.id, request.questions[0]);
});

server.on('requestError', (error) => {
  console.log('Client sent an invalid request', error);
});

server.on('listening', () => {
  console.log(server.addresses());
});

server.on('close', () => {
  console.log('server closed');
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

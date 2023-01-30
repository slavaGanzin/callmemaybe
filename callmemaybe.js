#!/usr/bin/env node

global.config = {}
Error.stackTraceLimit = Infinity

for (const f in require('ramda'))
  global[f] = require('ramda')[f]

const dns2 = require('dns2')
const daemonizeProcess = require('daemonize-process')
const yaml = require('yaml')
const { program } = require('commander')
const server = require('./server')
const {run, healthcheck} = require('./run')

const wait = t => new Promise(r => setTimeout(r, t))

const pp = x =>
  process.stdout.write(yaml.stringify(x || {}))

const pe = x =>
  process.stderr.write(yaml.stringify(x || {}))

dns2.pp = (x, comment='') =>
  console.log(comment + join('',values(mapObjIndexed((v,k) => `${k} -> ${join(' ', pluck('address',v))}`, groupBy(x => x.name, x.answers)))))

if (process.argv.length === 2) process.argv.push('start')

program
  .name('callmemaybe')
  .description('Local DNS server that launch commands if you ask for specific hostname')
  .version(require('./package.json').version)


program.command('server')
  .option('-r, --redirect <URL>')
  .option('-t, --title <title>')
  .parse()
  .action((str, options) => server(str))

program.command('start')
  .action(async (str, options) => {
  await require('./config')
  const server = dns2.createServer({
    udp: true,
    handle: async (request, send, rinfo) => {
      const response = dns2.Packet.createResponseFromRequest(request);
      const [ question ] = request.questions;
      const c = config[question.name]

      if (c) {
        // pp({matched: c})
        response.answers.push({
          name: question.name,
          type: dns2.Packet.TYPE.A,
          class: dns2.Packet.CLASS.IN,
          ttl: 1,
          address: c.ip || '127.0.0.1'
        })

       return await healthcheck(c, question.name)
       .catch(x => {
         run(c.start, question.name, {cwd: c.folder})
           .then(() => console.log(3))
           .catch(({stderr, stdout}) => {
             console.log('failed to start', {stderr, stdout})
             run(`callmemaybe server --title "${question.name} error"`, 'error-server', {input: stderr+stdout, restart: true})
              .catch(console.error)
           })

         return c.healthcheck ? healthcheck(c, question.name, true) : wait(300)
       })
       .then(async () => {
          if(c.redirect)
            await run(`callmemaybe server --redirect ${c.redirect}`, 'redirect', {restart: true})

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
    // console.log(request.header.id, request.questions[0])
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

program.parse()

#!/usr/bin/env node

global.config = {}
Error.stackTraceLimit = Infinity

for (const f in require('ramda'))
  global[f] = require('ramda')[f]

const dns2 = require('dns2')
const daemonizeProcess = require('daemonize-process')
const yaml = require('yaml')
const { program } = require('commander')
const {run, healthcheck} = require('./run')
const http = require('http')

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


const server = ({title = '', redirect}) => {
  let message = ''
  let closed = true
  process.stdin.on("data", data => {
    closed = false
    message += data.toString()
    process.stdout.write(message)
  })
  process.stdin.on('close', () => closed = true)

  try {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      if (redirect) res.writeHead(302, {'Location': redirect });
      res.write(`callmemaybe: ${title}\n\n${message}`)
      process.stdin.on("data", data => {
        res.write(data)
      })

      setInterval(() => {
        if (!closed) return
        res.end()
        console.log('one time server down')
        process.exit()
      }, 100)

    }).listen({port: 80, host: '0.0.0.0'}, () => console.log('one time server up'))
  } catch(e) {
    console.error(e)
  }
}


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
       const opts = {}
       if (c.folder) opts.cwd = c.folder
       if (c.user) opts.uid = await user2uid(c.user)
       if (c.group) opts.gid = await group2gid(c.user)
       if (c.shell) opts.shell = c.shell

       console.log(opts)

       return await healthcheck(c, question.name, opts)
       .catch(x => {
         run(c.start, question.name, opts)
           .then(() => console.log(3))
           .catch(({stderr, stdout, shortMessage, originalMessage}) => {
             console.log('failed to start', {shortMessage, originalMessage, stderr, stdout})
             run(`callmemaybe server --title "${question.name} error"`, 'error-server', {input: stderr+stdout, restart: true})
              .catch(console.error)
           })

         return c.healthcheck ? healthcheck(c, question.name, opts, true) : wait(300)
       })
       .then(async () => {
          if(c.redirect) {
            run(`callmemaybe server --redirect ${c.redirect}`, 'redirect')
            await wait(300)
          }

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
      resolve(question.name)
      .then(lookup => {
        response.answers = lookup.answers
        response.header.ancount = lookup.header.ancount
        response.header.arcount = lookup.header.arcount
        response.header.z = lookup.header.z
        response.header.ra = lookup.header.ra
        dns2.pp(response)
        send(response)
      })
      .catch(e => console.error(`error: ${question.name} ${e}`))
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

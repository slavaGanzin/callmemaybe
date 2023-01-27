const yaml = require('yaml')
const {readFile, writeFile, stat, mkdir, createWriteStream} = require('fs').promises
const stream = require('stream')
const {promisify} = require('util')
const fs = require('fs')
const got = require('got')

const pipeline = promisify(stream.pipeline);

const SYSTEMD = '/etc/systemd/system/callmemaybe.service'

stat(SYSTEMD).catch(() => writeFile(SYSTEMD, `[Unit]
Description=DNS server that launch commands if you ask for specific hostname

[Service]
Type=simple
ExecStart=/usr/local/bin/callmemaybe
AmbientCapabilities=CAP_NET_BIND_SERVICE
LimitNOFILE=infinity
Restart=always
SyslogIdentifier=callmemaybe

[Install]
WantedBy=default.target
`).then(() => console.log(`

${SYSTEMD} created.
Run it with:
  sudo systemctl start callmemaybe

For autostart run:
  sudo systemctl enable --now callmemaybe


`))
)

const CONFIG_FILES = [`/etc/callmemaybe.yaml`]

const deepdiff = require('deep-diff')

const realoadBlocklist = () =>
  Promise.all(map(f => {
      const filename = f.replace(/\//g,'_')
      return readFile(filename)
        .catch(async () => {
          console.log(`Loading ${f}`)
          await pipeline(got.stream(f), fs.createWriteStream(filename))
          return readFile(filename)
        })
        .then(String)
        .then(replace(/#.*|0.0.0.0\s*|www\./gim, ''))
        .then(split('\n'))
    }, propOr([], 'blocklists', config.settings))
  ).then(x => global.blocklist = new Set(flatten(x)))

const reloadConfig = async () => {
  const p = when(is(Object), yaml.stringify)
  const f = CONFIG_FILES[0]
  const oldconfig = clone(config)
  config = yaml.parse(await readFile(f, 'utf8'))

  const d = reduce((a, {path, lhs, rhs}) => assocPath(path, `${p(lhs)} -> ${p(rhs)}`, a), {}, deepdiff(oldconfig, config) || [])

  if (!isEmpty(d)) {
    realoadBlocklist()

    if (!isEmpty(oldconfig))
      console.log(`\n\nConfig updated:\n${yaml.stringify(d)}\n\n`)
  }
}

module.exports = Promise.all(CONFIG_FILES.map(x => readFile(x).catch(() =>
  writeFile(x, `settings:
  udp:
    port: 53
    address: 0.0.0.0
    type: "udp4"  #(Must be either "udp4" or "udp6")
  tcp:
    port: 53
    address: 0.0.0.0
    type: "udp4"  #(Must be either "udp4" or "udp6")

  # list of standard hosts files (like one in your /etc/hosts)
  # could be a path to a file or URL to hosts file to download
  # all hosts will be resolved to 0.0.0.0, so it's like poorman's adblock
  # https://en.wikipedia.org/wiki/Domain_Name_System_blocklist
  blocklists: ~
    # - http://sbc.io/hosts/hosts #adware + spyware from https://github.com/StevenBlack/hosts#list-of-all-hosts-file-variants


  resolvers: ~


#loopback
localhost:
  ip: 127.0.0.1

# Place here your own projects/hosts.
# Params and default values
# hostname:                     #hostname of your action
#   ip:          127.0.0.1      #what ip hostname resolve to.
#   healthcheck: ~              #any command that checks that project is up, so there is no need to run start command
#   start:       ~              #command that starts your project
#   folder:      ~              #folder where command will be running


#test endpoint. Feel free to remove
test.callmemaybe:
  start: callmemaybe --test
`).then(() => console.log(`

${x} created.

Edit it with:
  ${process.env.EDITOR || 'vim'} ${x}

`))
)))
.then(reloadConfig)
.then(() => setInterval(reloadConfig, 1000))

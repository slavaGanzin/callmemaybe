const yaml = require('yaml')
const {readFile, writeFile, stat} = require('fs').promises
const {homedir} = require('os')

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

const CONFIG_FILES = [`${homedir()}/.config/callmemaybe.yaml`]

const deepdiff = require('deep-diff')

const reloadConfig = async () => {
  const p = when(is(Object), yaml.stringify)
  const f = CONFIG_FILES[0]
  const oldconfig = clone(config)
  config = yaml.parse(await readFile(f, 'utf8'))
  if (!isEmpty(oldconfig)) {
    const d = reduce((a, {path, lhs, rhs}) => assocPath(path, `${p(lhs)} -> ${p(rhs)}`, a), {}, deepdiff(oldconfig, config) || [])
    if (!isEmpty(d)) console.log(`\n\nConfig updated:\n${yaml.stringify(d)}\n\n`)
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

# Array of dns resolvers. defaults to system resolvers
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

# callmemaybe

[![callmemaybe](https://media3.giphy.com/media/kGdRnb1kF4OmQ/giphy.gif?cid=ecf05e472pq6o5ggg6vq0w1b88g3221a7cevv2orxgm6rva7&rid=giphy.gif&ct=g)](https://www.youtube.com/watch?v=fWNaR-rxAic&t=86s)

*hostname as an interface*
Single binary local DNS server that launch commands if you ask for specific hostname

## Why?

I have a lot of projects. Switching between them is a pain: some of them use docker, some are started from systemd, some just from cli with arbitrary params. Also you need to memoize that 192.168.1.1:9200 is elasticsearch in one project, and 67.122.34.55:5423 is a postgres on another. And you need to find that dreaded command that creates proxy between your production pod to your local machine.
A lot to deal with.

So I wanted to open http://project1 in browser and project1 will be up automagically: no need to run something. And then when I need to connect to database I could just use http://db.project1 as connection string and all ssh/kubernetes port forwarding would be hidden from me.

## Installation
```bash
curl https://i.jpillora.com/slavaGanzin/callmemaybe! | bash
```

## Usage
```bash
sudo callmemaybe
```

Default config contains:
```yaml
test.callmemaybe:
  start: callmemaybe --test
```

So test that everything is working:
```bash
curl test.callmemaybe
# or open it in browser
chromium http://test.callmemaybe
```

## What can you do with it?

#### Switch between project branches
```yaml
project1.local:
  ip: 127.0.0.1
  folder: /path/to/project
  command: git checkout main; docker-compose down; docker-compose up -d
  healthcheck: curl 127.0.0.1

develop.project1.local:
  ip: 127.0.0.1
  folder: /path/to/project
  command: git checkout develop; docker-compose down; docker-compose up -d
  healthcheck: curl 127.0.0.1
```

## Config

Edit `~/.config/callmemaybe.yaml` to add your projects and hosts.
BTW, configuration reloads every second - no need to restart callmemaybe everytime you make a change.

```yaml
settings:
  resolvers: ~ # defaults to system resolvers
#   - 1.1.1.1
#   - 8.8.8.8

hostname:               #hostname of your action
    ip:                 #what ip hostname resolve to
    healthcheck:        #any command that checks that project is up and there is no need to run something to start it
    command:            #command that starts your project
    folder:             #folder where command will be running
```

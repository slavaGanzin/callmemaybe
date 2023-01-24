# callmemaybe

[![callmemaybe](https://media3.giphy.com/media/kGdRnb1kF4OmQ/giphy.gif?cid=ecf05e472pq6o5ggg6vq0w1b88g3221a7cevv2orxgm6rva7&rid=giphy.gif&ct=g)](https://www.youtube.com/watch?v=fWNaR-rxAic&t=86s)

single binary local DNS server that launch commands if you ask for specific URL.

## Why?

I have a lot of projects. Switching between them is a pain: some of them use docker, some are started from systemd, some just from cli with arbitrary params. A lot to deal with
So I wanted to open `http://project1.local` in browser and project1 will be up automagically: no need to run something.

## Installation
```bash
curl https://i.jpillora.com/slavaGanzin/callmemaybe! | bash
```

## Usage
```bash
sudo callmemaybe
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

# callmemaybe

[![callmemaybe](https://media3.giphy.com/media/kGdRnb1kF4OmQ/giphy.gif?cid=ecf05e472pq6o5ggg6vq0w1b88g3221a7cevv2orxgm6rva7&rid=giphy.gif&ct=g)](https://www.youtube.com/watch?v=fWNaR-rxAic&t=86s)

local DNS server that launches commands if you ask for specific URL.


## Why?

I have a lot of projects. Switching between them is a pain: some of them use docker, some are started from systemd, some just from cli with speciefic params.
So I wanted to open project1.local in browser and it will be up automagically: no need to run something.

## What can you do with it?
A lot. For example you could switch branches of your project just opening url in browser.

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

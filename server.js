const http = require('http')

module.exports = ({title = '', redirect}) => {
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

      if (closed) setTimeout(() => {
          res.end()
          console.log('one time server down')
          process.exit()
        }, 300)

    }).listen({port: 80, host: '0.0.0.0'}, () => console.log('one time server up'))
  } catch(e) {
    console.error(e)
  }
}

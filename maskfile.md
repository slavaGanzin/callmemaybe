## pkg
```bash
rm -rf bin/
version=`fx package.json .version`
pkg -t node18-linux-x64 callmemaybe.js --compress brotli --output bin/callmemaybe_${version}_linux_amd64
```

## release
```bash
mask pkg
version=`fx package.json .version`
find bin -type f | parallel tar czf {}.tgz {}
gh release delete v${version} --yes
gh release create v${version} ./bin/*.tgz --title "calmmemaybe $version" --generate-notes --latest 
```





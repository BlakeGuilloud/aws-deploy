#!/usr/bin/env node

const program = require('commander');

const deployStaticSite = require('./lib/deployStaticSite');

program
  .command('static')
  .description('Deploy a static website to an S3 bucket.')
  .option('-r, -region [region]', 'Which region to use')
  .option('-s, -source [source]', 'Which source to use')
  .option('-p, -profile [profile]', 'Which AWS profile creds to use')
  .action(deployStaticSite);

program.parse(process.argv);
  
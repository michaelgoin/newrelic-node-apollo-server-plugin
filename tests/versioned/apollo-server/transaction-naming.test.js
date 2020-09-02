/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const http = require('http')
const { ApolloServer, gql } = require('apollo-server')

const utils = require('@newrelic/test-utilities')

const typeDefs = gql`
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books: [Book]
  }
`

const books = [
  {
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling'
  },
  {
    title: 'Jurassic Park',
    author: 'Michael Crichton'
  }
]

const resolvers = {
  Query: {
    books: () => books
  }
}

tap.test('apollo-server', (t) => {
  t.autoend()

  let server = null
  let serverUrl = null
  let helper = null

  t.beforeEach((done) => {
    // load default instrumentation. express being critical
    helper = utils.TestAgent.makeInstrumented()
    const createPlugin = require('../../../lib/create-plugin')
    const nrApi = helper.getAgentApi()

    // TODO: eventually use proper function for instrumenting and not .shim
    const plugin = createPlugin(nrApi.shim)

    server = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [plugin]
    })

    server.listen().then(({ url }) => {
      serverUrl = url
      done()
    })
  })

  t.afterEach((done) => {
    server.stop()

    helper.unload()
    server = null
    serverUrl = null
    helper = null

    done()
  })

  // TODO: mutations
  // TODO: other?

  t.test('named query', (t) => {
    const query = `query MyNamedQuery {
      books {
        title
        author
      }
    }`

    helper.agent.on('transactionFinished', (transaction) => {
      t.equal(transaction.name, '/something')

    })

    executeQuery(serverUrl, query, (err, data) => {
      // verify we didn't break anything
      t.error(err)
      t.ok(data)

      t.end()
    })
  })

  t.test('anonymous query', (t) => {
    const query = `query {
      books {
        title
        author
      }
    }`

    helper.agent.on('transactionFinished', (transaction) => {
      t.equal(transaction.name, '/something')

    })

    executeQuery(serverUrl, query, (err, data) => {
      // verify we didn't break anything
      t.error(err)
      t.ok(data)

      t.end()
    })
  })
})

function executeQuery(url, query, callback) {
  const postData = JSON.stringify({ query })

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }

  const req = http.request(url, options, (res) => {
    res.setEncoding('utf8')

    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      const result = JSON.parse(data)
      callback(null, result)
    })
  })

  req.on('error', (e) => {
    callback(e)
  })

  req.write(postData)
  req.end()
}

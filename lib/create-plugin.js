/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

 'use strict'

function createPlugin(instrumentationApi) {
  return {
    requestDidStart(context) {
      // TODO: should we override/add to framework field for env and other?
      // would want to do that on requesting instrumentation...

      // TODO: start a graphql segment

      const paths = []

      return {
        didResolveOperation(context) {
          // TODO: rename graphql segment
          // somethign slightly different than transaction?

          // If the operation is anonymous (i.e., the operation is query { ... }
          // instead of query NamedQuery { ... }), then operationName is null.

          // do something with transaction name
          // is operationName always null? when is it not?
          const name = context.operationName

          const type = context.operation.operation
          let transactionName = type
          if (name) {
            transactionName += ' ' + name
          }

          // TODO: this doesn't seem to stick for some requests
          // due to normalization
          instrumentationApi.setTransactionName(transactionName)

          // TODO: set transaction name

          // TODO: thinking operationName makes sense as an attribute.
          // maybe part of the name?

          // query <anonymous> (fields)
          // query MyName (fields)

          // TODO: optionally capture variable definitions as attributes?

          // TODO: we could capture deep path as attribute on transaction?
        },
        executionDidStart: () => ({
          willResolveField(context) {
            const {info} = context

            // TODO: name field/resolver off of just field or whole path?
            // path should at least be an attribute

            // this has a path!
            console.log(info.path)

            paths.push(info.path)

            // todo: this has field name. perhaps we layer on? is that n MGI concern?

            // console.log(info)
          }
        }),

        willSendResponse: (context) => {
          // TODO: on error, a lot of this stuff may not be here
          // test with malformed queries

          const {response} = context

          const name = context.operationName || '<anonymous>'

          const type = context.operation.operation


          /** Field naming */

          // let fieldSelections = ''
          // context.operation.selectionSet.selections.forEach((selection) => {
          //   if (fieldSelections !== '') {
          //     fieldSelections += ','
          //   }

          //   let subSelections = ''

          //   if (selection.selectionSet) {
          //     // todo: do this until run out
          //     selection.selectionSet.selections.forEach((subSelection) => {
          //       let subSubSelections = ''
          //       if (subSelection.selectionSet) {
          //         subSelection.selectionSet.selections.forEach((subSubSelection) => {
          //           if (subSubSelections !== '') {
          //             subSubSelections += ','
          //           }

          //           subSubSelections += subSubSelection.name.value
          //         })
          //       }

          //       if (subSelections !== '') {
          //         subSelections += ','
          //       }

          //       subSelections += subSelection.name.value
          //       if (subSubSelections) {
          //         subSelections += `:{${subSubSelections}}`
          //       }
          //     })
          //   }

          //   // fieldSelections[selection.name.value] = `{${subSelections}}`
          //   fieldSelections += `${selection.name.value}`
          //   if (subSelections) {
          //     fieldSelections += `:{${subSelections}}`
          //   }
          // })

          // //console.log(fieldSelections.toString())
          // const selectionSets = `{${fieldSelections}}`
          // console.log(selectionSets)


          // const transactionName = `${type} ${name} ${selectionSets}`

          /************** */

          let longestPathArray = null
          paths.forEach((graphQlPath) => {
            let pathArray = []
            pathArray.push(graphQlPath.key)

            let thisPath = graphQlPath
            while (thisPath.prev) {
              pathArray.push(thisPath.prev.key)
              thisPath = thisPath.prev
            }

            console.log(pathArray.reverse().join('.'))

            if (!longestPathArray || pathArray.length > longestPathArray.length) {
              longestPathArray = pathArray
            }
          })


          /**** Longest path naming */
          const longestPath = longestPathArray.reverse().join('.')
          const transactionName = `${type} ${name} ${longestPath}`
          /******************* */

          // We name at the end to avoid typical web transaction renaming
          // instrumentationApi.setTransactionName(transactionName)
          forceName(instrumentationApi.agent, transactionName)

          // TODO: deepest path as attribute?


          // maybe like below but truncated

          // query/<anonymous>/{books: {title,author}, cds: {title,artist}}
          // query/QueryName/{books: {title,author}}
          // query/QueryName/{books: {title}}

          // console.log(response)
        }
      }
    }
  }
}

function forceName(agent, name) {
  var transaction = agent.tracer.getTransaction()

  const framework = 'apollo-server' // 'GraphQL'
  transaction.forceName = `${framework}/${name}`
}

module.exports = createPlugin

/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

 'use strict'

// TODO: if the agent is disabled... return no-op plugin?!

function createPlugin(instrumentationApi) {
  return {
    requestDidStart(context) {
      const transaction = instrumentationApi.agent.tracer.getTransaction()
      console.log('requestDidStart transaction id', transaction.id)
      // TODO: should we override/add to framework field for env and other?
      // would want to do that on requesting instrumentation...

      // TODO: start a graphql segment

      const resolverInfos = []
      const argStuff = {}

      return {
        didResolveOperation(context) {
          const transaction = instrumentationApi.agent.tracer.getTransaction()
          console.log('didResolveOperation transaction id', transaction.id)

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
            // console.log(info.path)

            // TODO: add arguments to path entry
            let path = info.path
            console.log(info.fieldName)
            console.log(context.args)
            // if (context.args) {
            //   path += '('
            //   Object.keys(context.args).forEach((key) => {
            //     path += key
            //     path += ','
            //   })
            //   path += ')'
            // }
            resolverInfos.push({
              path,
              args: context.args
            })

            // TODO: prob need to ensure unique/handle situation where same thing appears more than once
            argStuff[info.fieldName] = context.args

            // todo: this has field name. perhaps we layer on? is that n MGI concern?

            // console.log(info)
          }
        }),

        willSendResponse: (context) => {
          const transaction = instrumentationApi.agent.tracer.getTransaction()
          console.log('willSendResponse transaction id', transaction.id)

          // TODO: url will always be `/`... should we replace with the sanitized query?

          // TODO: on error, a lot of this stuff may not be here
          // test with malformed queries

          // TODO: on error, depending on the type, may not have operation
          // the document has these details...
          const {response} = context

          const name = context.operationName || '<anonymous>'

          // TODO: stick with operation or use document?
          // Does the document have both when batched?
          // Fall back to document when operation null?
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
          let args = null
          resolverInfos.forEach((resolverInfo) => {
            let pathArray = []
            pathArray.push(resolverInfo.path.key)

            let thisPath = resolverInfo.path
            while (thisPath.prev) {
              // if (typeof thisPath.prev.key !== 'number') {
              //   pathArray.push(thisPath.prev.key)
              // }
              pathArray.push(thisPath.prev.key)
              thisPath = thisPath.prev
            }

            // console.log(pathArray.reverse().join('.'))

            if (!longestPathArray || pathArray.length > longestPathArray.length) {
              longestPathArray = pathArray
              args = resolverInfo.args
            }
          })

          // TODO: this doesn't work for deep queries where args near the start
          // It appears user args are only available at the top level
          // so maybe could just add for that... or collection of fieldName - args?
          // let argsString = null
          // const argKeys = Object.keys(args)
          // if (argKeys.length > 0) {
          //   const joined = argKeys.join(',')
          //   argsString = `(${joined})`
          // }


          /**** Longest path naming */
          const longestPath = longestPathArray.reverse().join('.')
          let transactionName = `${type} ${name} ${longestPath}`

          // let argsString = null
          // const argKeys = Object.keys(argStuff)
          // argKeys.forEach((fieldName) => {
          //   if (transactionName.indexOf(fieldName) >= 0) {
          //     const fieldArgs = Object.keys(argStuff[fieldName])
          //     if (fieldArgs.length > 0) {
          //       const joined = fieldArgs.join(',')
          //       transactionName = transactionName.replace(
          //         fieldName,
          //         `${fieldName}(${joined})`
          //       )
          //     }
          //   }
          // })

          // if (argsString) {
          //   transactionName += argsString
          // }
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

  if (!transaction.forceName) {
    transaction.forceName = `${framework}/${name}`
    console.log('forced Name: ', transaction.forceName)
    return
  }

  transaction.forceName = transaction.forceName.replace(framework, `${framework}/batch`)
  const batchName = `${transaction.forceName}/${name}`
  transaction.forceName = batchName
  console.log('batched Name: ', transaction.forceName)

}

module.exports = createPlugin

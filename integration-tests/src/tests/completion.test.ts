/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { delay } from '../utils/async'

suite('Bitbake Completion Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/completion.bb')
  const docUri = vscode.Uri.parse(`file://${filePath}`)

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(100000)
    const vscodeBitbake = vscode.extensions.getExtension('yocto-project.yocto-bitbake')
    if (vscodeBitbake === undefined) {
      assert.fail('Bitbake extension is not available')
    }
    await vscodeBitbake.activate()
    await vscode.workspace.openTextDocument(docUri)
  })

  const checkHasItemWithLabel = (completionList: vscode.CompletionList, label: string): boolean => {
    return completionList.items.some(item => {
      if (typeof item.label === 'string') {
        return item.label === label
      }
      return item.label.label === label
    })
  }

  const testCompletion = async (position: vscode.Position, expected: string): Promise<void> => {
    let completionList: vscode.CompletionList = { items: [] }
    while (!checkHasItemWithLabel(completionList, expected)) {
      completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        docUri,
        position
      )
      // For completion to work, an "embedded language document" needs to be generated.
      // We have no practical way to know when it will be done.
      // Attempts to wait for the "embedded language document" to be created in its folder still produced incorrect results.
      // So here we are, just hoping everything is fine so our test won't take forever to fail.
      await delay(100)
    }
    assert.strictEqual(checkHasItemWithLabel(completionList, expected), true)
  }

  test('Completion appears properly on bitbake variable', async () => {
    const position = new vscode.Position(0, 2)
    const expected = 'DESCRIPTION'
    await testCompletion(position, expected)
  }).timeout(300000)

  test('Completion appears properly on embedded python', async () => {
    const position = new vscode.Position(3, 6)
    const expected = 'print'
    await testCompletion(position, expected)
  }).timeout(300000)

  test('Completion appears properly on embedded bash', async () => {
    const position = new vscode.Position(7, 6)
    const expected = 'echo'
    await testCompletion(position, expected)
  }).timeout(300000)
})

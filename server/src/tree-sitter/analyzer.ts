/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

import {
  type TextDocumentPositionParams,
  type Diagnostic,
  type SymbolInformation,
  DiagnosticSeverity
} from 'vscode-languageserver'
import type Parser from 'web-tree-sitter'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getGlobalDeclarations, type GlobalDeclarations } from './declarations'
import { getAllErrorNodes } from './errors'
import { debounce } from '../utils/async'
import { type Tree } from 'web-tree-sitter'

const DEBOUNCE_TIME_MS = 500

interface AnalyzedDocument {
  document: TextDocument
  globalDeclarations: GlobalDeclarations
  tree: Parser.Tree
}

export default class Analyzer {
  private parser?: Parser
  private uriToAnalyzedDocument: Record<string, AnalyzedDocument | undefined> = {}
  private debouncedExecuteAnalyzation?: ReturnType<typeof debounce>

  public initialize (parser: Parser): void {
    this.parser = parser
  }

  public async analyze ({
    document,
    uri
  }: {
    document: TextDocument
    uri: string
  }): Promise<Diagnostic[]> {
    const fileContent = document.getText()

    if (this.parser === undefined) {
      console.log('The analyzer is not initialized with a parser')
      return await Promise.resolve([])
    }
    const tree = this.parser.parse(fileContent)
    const globalDeclarations = getGlobalDeclarations({ tree, uri })

    this.uriToAnalyzedDocument[uri] = {
      document,
      globalDeclarations,
      tree
    }
    let debouncedExecuteAnalyzation = this.debouncedExecuteAnalyzation
    if (debouncedExecuteAnalyzation === undefined) {
      debouncedExecuteAnalyzation = debounce(this.executeAnalyzation.bind(this), DEBOUNCE_TIME_MS)
      this.debouncedExecuteAnalyzation = debouncedExecuteAnalyzation
    }

    return await debouncedExecuteAnalyzation(document, uri, tree)
  }

  private executeAnalyzation (document: TextDocument, uri: string, tree: Tree): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    const errorNodes = getAllErrorNodes(tree)

    errorNodes.forEach(node => {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: {
            line: node.startPosition.row,
            character: node.startPosition.column
          },
          end: {
            line: node.endPosition.row,
            character: node.endPosition.column
          }
        },
        message: `Invalid syntax "${node.text.trim()}" `,
        source: 'ex'
      }
      diagnostics.push(diagnostic)
    })

    return diagnostics
  }

  public getGlobalDeclarationSymbols (uri: string): SymbolInformation[] {
    const symbols: SymbolInformation[] = []
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { globalDeclarations } = analyzedDocument
      Object.values(globalDeclarations).forEach((symbol) => symbols.push(symbol))
      return symbols
    }
    return []
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint (uri: string, line: number, column: number): string | null {
    const node = this.nodeAtPoint(uri, line, column)

    if (node === null || node.childCount > 0 || node.text.trim() === '') {
      return null
    }

    return node.text.trim()
  }

  public wordAtPointFromTextPosition (
    params: TextDocumentPositionParams
  ): string | null {
    return this.wordAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  }

  /**
   * Find the node at the given point.
   */
  private nodeAtPoint (
    uri: string,
    line: number,
    column: number
  ): Parser.SyntaxNode | null {
    const tree = this.uriToAnalyzedDocument[uri]?.tree

    if (tree === undefined) {
      return null
    }

    if (tree.rootNode === null) {
      // Check for lacking rootNode (due to failed parse?)
      return null
    }

    return tree.rootNode.descendantForPosition({ row: line, column })
  }
}

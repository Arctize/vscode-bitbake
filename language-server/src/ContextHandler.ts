/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    TextDocumentPositionParams,
    CompletionItem,
    CompletionItemKind,
    Definition,
    Location,
    Range
} from "vscode-languageserver";

import {
    BitBakeProjectScanner,
    ElementInfo,
    PathInfo
} from "./BitBakeProjectScanner";

import {
    BasicKeywordMap
} from './BasicKeywordMap';

import {
    DefinitionProvider
} from "./DefinitionProvider";

import {
    CompletionProvider
} from "./CompletionProvider";


const find = require('find');


/**
 * ContextHandler
 */
export class ContextHandler {

    private _projectScanner: BitBakeProjectScanner = null;
    private _definitionProvider: DefinitionProvider = null;
    private _completionProvider: CompletionProvider = null;

    constructor(projectScanner: BitBakeProjectScanner) {
        this._projectScanner = projectScanner;
        this._definitionProvider = new DefinitionProvider(this._projectScanner);
        this._completionProvider = new CompletionProvider(this._projectScanner);
    }

    getDefinition(textDocumentPositionParams: TextDocumentPositionParams, documentAsText: string[]): Definition {
        let definition: Definition = null;

        if (documentAsText.length > textDocumentPositionParams.position.line) {
            let keyWord: string = this.getKeyWord(textDocumentPositionParams, documentAsText);
            let currentLine: string = documentAsText[textDocumentPositionParams.position.line];

            if ((keyWord !== undefined) && (keyWord !== '')) {
                definition = this.getDefinitionForKeyWord(keyWord, currentLine);
            } else {
                this.extractSymbolFromLine(textDocumentPositionParams, currentLine);
            }
        }
        return definition;
    }

    private getDefinitionForKeyWord(keyWord: string, currentLine: string): Definition {
        let definition: Definition = null;
        let words: string[] = currentLine.split(' ');

        if (words.length === 2) {
            if (words[0] === keyWord) {
                console.log(`getDefinitionForKeyWord: ${JSON.stringify(words)}`);
                definition = this._definitionProvider.createDefinition(keyWord, words[1]);
            }
        }

        return definition;
    }

    private extractSymbolFromLine(textDocumentPositionParams: TextDocumentPositionParams, currentLine: string): string {

        console.log(`getDefinitionForSymbol ${currentLine}`);
        let linePosition: number = textDocumentPositionParams.position.character;
        let symbolEndPosition: number = currentLine.length;
        let symbolStartPosition: number = 0;
        let rightBorderCharacter: string[] = [' ', '=', '/', '$', '+', '-', '}', '"'];
        let leftBorderCharacter: string[] = [' ', '=', '/', '+', '-', '{', '"'];

        for (let character of rightBorderCharacter) {
            let temp: number = currentLine.indexOf(character, linePosition);
            if (temp === -1) {
                temp = currentLine.length;
            }
            symbolEndPosition = Math.min(symbolEndPosition, temp);
        }

        let symbolRightTrimed = currentLine.substring(0, symbolEndPosition);
        console.log(`symbolRightTrimed ${symbolRightTrimed}`);

        for (let character of leftBorderCharacter) {
            let temp: number = symbolRightTrimed.lastIndexOf(character, linePosition);
            if (temp === -1) {
                temp = 0;
            }
            symbolStartPosition = Math.max(symbolStartPosition, temp);
        }

        let symbol: string = symbolRightTrimed.substring(symbolStartPosition);
        
       for (let character of leftBorderCharacter) {
           if( symbol.startsWith(character) ) {
               symbol = symbol.substring(1);
               break;
           }
        }

        console.log(`symbol ${symbol}`);

        return symbol;
    }

    getComletionItems(textDocumentPosition: TextDocumentPositionParams, documentAsText: String[]): CompletionItem[] {
        let completionItem: CompletionItem[];

        if (documentAsText.length > textDocumentPosition.position.line) {
            let keyWord: string = this.getKeyWord(textDocumentPosition, documentAsText);

            if ((keyWord === undefined) || (keyWord === '')) {
                completionItem = this._completionProvider.createCompletionItem('*');
            } else {
                completionItem = this._completionProvider.createCompletionItem(keyWord);
            }
        }

        return completionItem;
    }

    getInsertStringForTheElement(item: CompletionItem): string {
        return this._completionProvider.getInsertStringForTheElement(item);
    }

    private getKeyWord(textDocumentPosition: TextDocumentPositionParams, documentAsText: String[]): string {
        let currentLine = documentAsText[textDocumentPosition.position.line];
        let lineTillCurrentPosition = currentLine.substr(0, textDocumentPosition.position.character);
        let words: string[] = lineTillCurrentPosition.split(' ');

        let basicKeywordMap: CompletionItem[] = BasicKeywordMap;
        let keyword: string;

        if (words.length > 1) {
            let basicKey: CompletionItem = basicKeywordMap.find((obj: CompletionItem): boolean => {
                return obj.label === words[0];
            });

            if (basicKey !== undefined) {
                keyword = basicKey.label;
            }
        }

        return keyword;
    }
}
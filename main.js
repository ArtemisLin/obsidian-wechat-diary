/*
 * WeChat Diary v0.1.0 — 对着微信说话, 日记直接落进你的 Obsidian 库。
 *
 * 这是 wechat-diary (Python 版, github.com/ArtemisLin/wechat-diary) 的插件形态。
 * 纯 JS 手写, 无构建步骤——想改它, 把这个文件丢给任何 AI 就行。
 *
 * 工作原理: 扫码绑定微信 bot → 长轮询收消息(腾讯官方 iLink 协议, 直连不走代理)
 * → 意图识别(记日记/闲聊/撤回/结束) → 追加写入 vault 里的 日记/YYYY/YYYY-MM-DD.md。
 * 图片走微信 CDN(AES-128-ECB 加密), 解密后存进 日记/attachments/, 笔记里插 ![[]]。
 * 写入格式与 Python 版逐字节一致(docs/data-contract.md), 两种形态可随时互迁。
 * bot token 与 AI Key 存 Obsidian 密钥存储(不进 vault, 不被同步盘带走)。
 *
 * 文件结构: [内嵌 qrcode-generator 库] → [插件本体] → module.exports。
 *
 * Copyright (C) 2026 ArtemisLin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3.
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License
 * for more details: <https://www.gnu.org/licenses/agpl-3.0.html>.
 * 商业授权(闭源使用)请联系作者: https://github.com/ArtemisLin/obsidian-wechat-diary
 * (内嵌的 qrcode-generator 保持其原有 MIT 授权, 见下方声明。)
 */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

// ═══════════════════════════════════════════════════════════════════════
// 以上为内嵌的 qrcode-generator (MIT, Kazuhiko Arase)。
// 以下为 WeChat Diary 插件本体。文件末尾的 module.exports 覆盖上方 UMD 段的赋值。
// ═══════════════════════════════════════════════════════════════════════

const { Plugin, PluginSettingTab, Setting, Modal, Notice, normalizePath, requestUrl, Platform, AbstractInputSuggest, moment } = require("obsidian");

const PLUGIN_VERSION = "0.3.0";
const AGENT_NAME = "obsidian-wechat-diary";
const BOT_AGENT = AGENT_NAME + "/" + PLUGIN_VERSION;
const CHANNEL_VERSION = "2.4.6";               // 对齐官方 @tencent-weixin/openclaw-weixin
const CLIENT_VERSION_HEADER = "132102";        // (2<<16)|(4<<8)|6, 版本号的 uint32 编码
const FIXED_BASE_URL = "https://ilinkai.weixin.qq.com";
const CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";  // 官方 src/auth/accounts.ts:12
const SECRET_BOT_TOKEN = "wechat-diary-ilink-bot-token";
const SECRET_AI_KEY = "wechat-diary-ai-api-key";
// 绑定身份(userId/botId/baseUrl)与 token 同库存放。它们本身不敏感, 放这里是为了
// 生命周期一致: data.json 会被卸载删掉、被同步盘回滚, secret 不会。两半分家就是 v0.2.1
// 修的那个"半绑定"故障的根源(见 00-decisions.md D5 补记)。
const SECRET_BIND_ID = "wechat-diary-bind-identity";

const LONG_POLL_TIMEOUT_MS = 35000;
const SEND_TIMEOUT_MS = 15000;
const MEDIA_TIMEOUT_MS = 60000;                // 图片下载: 手机拍的原图可能几 MB, 给足时间
const MEDIA_TIMEOUT_LONG_MS = 300000;          // 文件/视频最大 100MB, 下载窗口给足
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;     // 协议上限(官方 WEIXIN_MEDIA_MAX_BYTES 同值)
const MEDIA_MAX_BYTES = 100 * 1024 * 1024;     // 同官方 WEIXIN_MEDIA_MAX_BYTES
const MEDIA_MAX_REDIRECTS = 3;                 // CDN 可能 302; Node https 不自动跟, 官方用的 fetch 会跟
const NOTIFY_TIMEOUT_MS = 10000;
const QR_FETCH_TIMEOUT_MS = 15000;
const LOGIN_TOTAL_TIMEOUT_MS = 480000;
const QR_LOCAL_TTL_MS = 5 * 60 * 1000;         // 单张二维码本地 TTL(同官方): 服务端不一定报 expired, 到点自己换码
const STALE_TOKEN_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000;       // -14 冷却整 1 小时, 同官方
const MAX_RECENT_SEQS = 200;
const OFFLINE_NOTICE_GAP_H = 24;   // 缓冲窗口 24h 内实测可补收(2026-08-16), 之内不吓唬用户

const DEFAULT_SETTINGS = {
  diaryFolder: "日记",
  // 默认只抓公众号链接；其它站点需用户主动打开扩展开关。
  webClipEnabled: true,
  webClipOtherSites: false,
  // 空值表示跟随 <日记文件夹>/剪藏；用户填入后才固定为自定义目录。
  webClipFolder: "",
  // 只下载正文容器里的栅格图, 落进剪藏附件目录并改写为本地 Obsidian embed。
  webClipSaveImages: true,
  webClipMaxImages: 30,
  webClipMaxTotalImageMb: 50,
  // 防异常网页把 vault 撑爆。约 20 万汉字已远超通常长文, 超出部分会明确标注截断。
  webClipMaxChars: 200000,
  timezone: "Asia/Shanghai",
  aiApiUrl: "",
  aiModel: "",
  // 一天的边界(小时): 凌晨 4 点前记的都算前一天(契约 v1.2)。取代 v0.3.0 前的
  // 滚动宽限期(graceMinutes, 已退役)。暂无设置 UI, 要改的用户直接编辑 data.json。
  dayStartHour: 4,
  // 夜间收尾提示的起点(小时): 当天第一条落在这个点之后的消息, 回执附一句"睡前说声「晚安」"。
  // 与 dayStartHour 一样暂无 UI, 改 data.json 生效。
  nudgeNightHour: 22,
  // 每日提醒(D10, 2026-08-19 谷雨拍板默认开): 到点时今天还什么都没记 → 微信上提醒一次。
  reminderEnabled: true,
  reminderTime: "21:30",
  // 保存语音原声(D12, 2026-08-20 谷雨拍板: 开关型、默认关): 开了之后语音消息 = 原声 wav + 转写文字同块,
  // 桌面端渲染成微信样式的语音气泡(点击即播)。默认关: 文字为主, 音频约 3MB/分钟计入库体积且被同步盘带走。
  saveVoiceAudio: false,
  // #15 / D13 (2026-08-30): 路径可配置 + 写进已有的每日笔记。默认值渲染结果与 0.3.1 逐字相同(bindtest【G】黄金回归盯着)。
  pathFormat: "YYYY/YYYY-MM-DD",   // moment 格式, 相对日记文件夹; 英文字母是日期代码, 文件夹名放 [方括号]
  attachmentMode: "diary",         // diary(日记文件夹内 attachments/YYYY, 现状) | obsidian(跟随 Obsidian 附件设置) | custom(下面的文件夹)
  attachmentFolder: "",            // custom 模式的附件文件夹(库里选的文件夹路径; "/" = 库根目录)
  attachmentSubFormat: "",         // custom 模式下按日期分的子文件夹, moment 格式(如 YYYY/MM), 可空
  sharedDailyNote: false,          // 开: 不单独建文件, 写进当天每日笔记末尾的「## <sectionHeading>」一节, 插件只动这一节
  sectionHeading: "微信随手记",     // 节标题文字(不含 ##, 级别固定二级)
  templatePath: "",                // 共用模式下当天文件不存在时用的模板(vault 内 .md 路径; 空 = 只建我们那一节)
};

// ── 北京时间工具(019 config.py 的教训: 禁止裸用宿主机本地时间)─────────

let _tz = "Asia/Shanghai";
let _dateFmt, _timeFmt, _weekdayFmt;

function setTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch (e) {
    tz = "Asia/Shanghai";
  }
  _tz = tz;
  _dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: _tz, year: "numeric", month: "2-digit", day: "2-digit" });
  _timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: _tz, hour: "2-digit", minute: "2-digit", hour12: false });
  _weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: _tz, weekday: "short" });
}
setTimezone(_tz);

function todayStr(d) { return _dateFmt.format(d || new Date()); }
function hhmmStr(d) { return _timeFmt.format(d || new Date()); }

// ── 逻辑日(契约 v1.2): 凌晨 dayStartHour 点前算前一天 ──────────────────
// 「今天的文件」一律用它; 段头时间戳仍是真实时间(00:30 出现在昨天的文件里, 日记本来如此)。
let _dayStartHour = 4;
function setDayStartHour(h) {
  const n = Number(h);
  _dayStartHour = Number.isFinite(n) && n >= 0 && n <= 12 ? Math.floor(n) : 4;
}
function logicalTodayStr(d) {
  return todayStr(new Date((d ? d.getTime() : Date.now()) - _dayStartHour * 3600000));
}
// 现在是不是"深夜段"(20 点后到逻辑日边界前): 收尾语选晚安池用
function isNightNow(d) {
  const h = Number(hhmmStr(d).slice(0, 2));
  return h >= 20 || h < _dayStartHour;
}
// 夜间收尾提示用的"深夜"(默认 22 点起到逻辑日边界), 比收尾语的 20 点晚:
// 20 点说晚安不违和, 但 20 点就提示"睡前跟我说声晚安"太早(2026-08-19 谷雨拍板)。
let _nudgeNightHour = 22;
function setNudgeNightHour(h) {
  const n = Number(h);
  _nudgeNightHour = Number.isFinite(n) && n >= 12 && n <= 23 ? Math.floor(n) : 22;
}
function isLateNight(d) {
  const h = Number(hhmmStr(d).slice(0, 2));
  return h >= _nudgeNightHour || h < _dayStartHour;
}

const WEEKDAY_CN = { Mon: "一", Tue: "二", Wed: "三", Thu: "四", Fri: "五", Sat: "六", Sun: "日" };
function weekdayStr(d) { return "周" + (WEEKDAY_CN[_weekdayFmt.format(d || new Date())] || "?"); }
// 日历日期的星期与时区无关: 按 UTC 正午求值, 任何配置时区下都不会偏一天
const _weekdayFmtUTC = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
function weekdayForDate(dateStr) { return "周" + (WEEKDAY_CN[_weekdayFmtUTC.format(new Date(dateStr + "T12:00:00Z"))] || "?"); }
// 「昨天」不能用 now-24h 一把梭(DST 春季拨快夜只有 23 小时): 取第一个与今天不同的日期
function yesterdayStr(now) {
  const t = now || Date.now();
  const today = todayStr(new Date(t));
  for (const h of [24, 20, 28]) {
    const c = todayStr(new Date(t - h * 3600000));
    if (c !== today) return c;
  }
  return todayStr(new Date(t - 86400000));
}

function codePointLen(s) { return [...s].length; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randHex(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

// ── 文案资产(v0.3.0 单模式全面改写; 019 双模式文案退役)─────────────────

// 欢迎语按用户的日记文件夹设置动态生成: 入门用户得知道东西记去哪了、在哪改
function welcomeText(folder) {
  return `嗨~ 我是你的随手记 Agent ✍️

想记什么直接发给我, 文字、语音、图片、文件都行, 我会记到你今天的笔记里。
记的东西在 Obsidian 的「${folder}」文件夹; 想换地方: Obsidian 设置 → 第三方插件 → WeChat Diary → 日记文件夹。
说错了发「撤回」, 随时发「帮助」看全部用法。`;
}
const WELCOME_SNIPPET = "随手记 Agent"; // 测试与旧引用用

// 首次见面取名轮已退役(D11 方案B, 2026-08-20 谷雨拍板: "名字很多时候用不到", 且协议拿不到微信昵称)。
// 「叫我XX」保留为低调后门(帮助里有一行), 已设称呼的老用户不受影响。
const NAME_INLINE_CONFIRM_TEMPLATE = "(称呼记下啦, {name}~)";
const RENAME_CONFIRM_TEMPLATE = "好嘞{name}~ 以后就这么叫你啦 😊";
const NAME_MAX_LEN = 10;

// 单模式使用指南。末段把"关着也不丢"讲给用户(缓冲窗口 24h 实测, 2026-08-16)
const HELP_TEXT = `✍️ 微信随手记 使用指南

想记什么直接发, 文字、语音、图片、文件、视频都行, 自动记到今天的笔记里。
不用任何开场白, 发出去就记下了。

【命令】
• 撤回 → 删掉刚记的最后一条
• 晚安 / 结束 → 给今天收个尾 (不发也没关系, 跨天会自动收尾)
• 在吗 → 看我在不在、今天记了几段
• 叫我XX → 设置/修改你的称呼
• 记：xx → 把 xx 原样记下 (想把「晚安」这类会被当命令的词记进去时用)
• 帮助 → 看到这条

熬夜不怕跨天: 凌晨 4 点前记的都算前一天。
Obsidian 没开着也能发, 24 小时内下次打开会自动补记。`;

// 老用户习惯发「开始记日记」: 友好告知不用了, 不落库
const START_DIARY_OBSOLETE_REPLY = "现在不用特意开始啦~ 想记什么直接发就行 ✍️";
const START_DIARY_SUSPECT_NOTE = "(顺便说, 现在不用发「开始记日记」了, 直接说就记)";
// 「继续记录」的回执: 告知不用宣告, 顺便把「结束不影响继续记」讲清(用户多半刚「结束」过)
const CONTINUE_REPLY = "直接发就行~ 我一直记着呢 ✍️ (「结束」只是收尾标记, 之后发的照样记)";

// 图片相关文案
const IMAGE_FAIL_REPLY = "这张图没存下来 😢 网络或格式的问题, 要不重发一次?";
const IMAGE_DISK_FULL_REPLY = "存图片失败! 磁盘可能满了 💾 请检查磁盘空间";
const IMAGE_PARTIAL_TEMPLATE = "(有 {n} 张没存下来, 可以重发一次)";
function imageWrittenReply(n) {
  return "📷 图片收好啦~ 今天第 " + n + " 段 ✍️";
}

// 文件/视频/语音兜底(D10, 2026-08-19)。定位是笔记不是网盘, 但"发出去=记下了"对所有类型成立——静默扔掉肯定不行。
const FILE_FAIL_REPLY = "📎 这个文件没收下来 😢 网络或解密的问题, 等一会儿重发试试";
const FILE_DUP_KEY_REPLY = "📎 这个文件没收下来 😢 微信重复发送同一个文件时会给错密钥(它的毛病), 把文件改个名再发就好";
const FILE_TOO_BIG_REPLY = "📎 这个文件太大了(超过 100MB 上限), 存不下 😢";
const VIDEO_FAIL_REPLY = "🎬 这个视频没收下来 😢 网络或解密的问题, 等一会儿重发试试";
// 视频没有文件名, 「改个名再发」不可执行——视频版文案分开写(审稿轮抓出)
const VIDEO_DUP_KEY_REPLY = "🎬 这个视频没收下来 😢 微信重复发送同一段视频时会给错密钥(它的毛病), 稍后重发或改用文件方式发送试试";
const VIDEO_TOO_BIG_REPLY = "🎬 这个视频太大了(超过 100MB 上限), 存不下 😢";
// 磁盘满对语音/文件/视频不能说"存图片失败"(审稿轮抓出)
const ATTACH_DISK_FULL_REPLY = "存附件失败! 磁盘可能满了 💾 请检查磁盘空间";
function fileWrittenReply(name, n) { return "📎 「" + name + "」收好啦~ 今天第 " + n + " 段 ✍️"; }
function videoWrittenReply(n) { return "🎬 视频收好啦~ 今天第 " + n + " 段 ✍️"; }
function fileReusedReply(n) { return "📎 这份文件之前收过, 直接引用了原来那份~ 今天第 " + n + " 段 ✍️"; }
function videoReusedReply(n) { return "🎬 这段视频之前收过, 直接引用了原来那份~ 今天第 " + n + " 段 ✍️"; }
// 语音转写失败: 019/020 一直是"请重说"=内容丢了; 现在把原音频存下来("什么都别丢")
const VOICE_FALLBACK_FAIL_REPLY = "🎤 这条语音微信没转出文字, 我想把原音频存下来也没成功 😢 再说一遍?";
function voiceFallbackReply(n) { return "🎤 这条语音微信没转出文字, 原音频先存下了(今天第 " + n + " 段) ✍️ 想要文字版的话再说一遍也行"; }

// ── 每日提醒(D10, 2026-08-19 谷雨拍板: 默认开、21:30、今天没记才提醒、文案轮流、连续 3 天没写就闭嘴)──
// 019 的教训(D3): _is_token_fresh 的"20 小时窗口"是编的, 判定不新鲜连试都不试。
// 020 原则: 到点就发、不做任何预判、按返回码记录——真实送达窗口只能发着发着才知道。
const REMINDER_STREAK_MAX = 3;
// 提醒时间的合法形状: 0-23 时 + 两位 0-59 分。设置页与 reminderDue 用同一条(审稿轮抓出: 两处不一致会静默失效)
const REMINDER_TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const REMINDER_LINES = [
  "今天还什么都没记呢~ 要不要现在记一段? 想到什么直接发我 ✍️",
  "我在这儿等你呢~ 今天有什么想记的吗? 一句话也行 📖",
  "今天过得怎么样? 随手记一段吧, 发出去就记下了 ✍️",
  "还没听到你今天的消息~ 记点什么再睡吧, 我帮你收着 🌙",
];
function reminderText(idx) {
  const n = REMINDER_LINES.length;
  return REMINDER_LINES[((idx % n) + n) % n];
}
// 该不该发提醒(纯函数, 表驱动可测)。规则一句话: 到点了、今天(逻辑日)还什么都没记、
// 今天没提醒过、连续没写不满 3 天 → 发。时间比较在"逻辑日时钟"上做(21:30 的窗口一直开到凌晨 4 点)。
function reminderDue(ctx) {
  if (!ctx || !ctx.enabled) return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(ctx.timeStr || "").trim());
  if (!m) return false;
  const rh = Number(m[1]), rm = Number(m[2]);
  if (rh > 23 || rm > 59) return false; // 设置页同规则拦截(REMINDER_TIME_RE), 这里是纵深防御
  const [hh, mm] = hhmmStr(ctx.now).split(":").map(Number);
  const dayStart = _dayStartHour * 60;
  const nowLogical = (hh * 60 + mm - dayStart + 1440) % 1440;
  const remLogical = (rh * 60 + rm - dayStart + 1440) % 1440;
  if (nowLogical < remLogical) return false;
  if ((ctx.countToday || 0) > 0) return false;
  if (ctx.remindedDate && ctx.remindedDate === logicalTodayStr(ctx.now)) return false;
  if ((ctx.streak || 0) >= REMINDER_STREAK_MAX) return false;
  return true;
}

// 收尾语分时段(2026-08-16 谷雨审定): 备忘录用户中午也会「结束」, 白天说"晚安"违和。
// 20 点后到逻辑日边界前用晚安池, 其余用中性池。
const CLOSING_LINES_DAY = [
  "归档完毕, 今天的记录都到这里啦~",
  "文字已经记录好, 下次见~",
  "咔哒, 打卡完成 ✓ 今天辛苦了。",
];
const CLOSING_LINES_NIGHT = [
  "今天的故事我收好啦, 晚安 ✨",
  "小册子合上了, 安心睡吧。",
  "好了, 今天的心事都在本子里了。",
  "笔记本盖章 📮 愿今晚好梦。",
  "今天的文字, 都存好了, 晚安。",
];
const CLOSING_FAREWELL_DAY = ["下次见 👋", "明天见 👋", "明天再见呀 ✨"];
const CLOSING_FAREWELL_NIGHT = ["好梦, 明天见 🌙", "明天我等你 📖", "明天见 👋"];
const CLOSING_WITH_NAME_DAY = ["{name}, 今天这些文字都收好了 📖"];
const CLOSING_WITH_NAME_NIGHT = [
  "辛苦啦{name}~ 今天又记下了一些珍贵的东西 🌙",
  "{name}, 今天的故事我收好啦, 晚安 ✨",
];

// 探活回执(替代闲聊模式的问候回复): 回状态, 不落库。
// 「在吗」是用户自己发明的 ping——有回复=在线; 尊重它, 别把它记进笔记。
function pingReply(n) {
  if (n > 0) return "在的~ 今天已记 " + n + " 段 ✍️ 想记什么直接发";
  return "在的~ 想记什么直接发, 我都记着 ✍️";
}

// 每天第一条的回执前缀: 零动作给足"它在且在记"的信任信号; 完整命令提示每天只在这出现一次
const FIRST_OF_DAY_PREFIX = "今天的第一条记录, 已经记录在新开的文件里啦 📖\n";
const FIRST_OF_DAY_TIPS = "\n(说错了发「撤回」, 随时发「帮助」看全部用法)";
// 夜间收尾提示(2026-08-19 谷雨拍板): 把"怎么收尾"教在开头而不是中途打断——当天第一条落在深夜
// (nudgeNightHour 起)的消息, 回执附一句; 一天一次、终身最多 3 次、用户手动收尾过一次就永久闭嘴。
// 不按段数(段数多的恰是最不需要收尾的备忘录用户), 不做推送(bot 只在你说话时说话)。
// n===1 时并进 FIRST_OF_DAY_TIPS 的位置——一条回执只挂一个括号。
const NIGHT_SIGNOFF_TIP = "(睡前跟我说声「晚安」, 我给今天收个尾 🌙)";
const FIRST_OF_DAY_TIPS_NIGHT = "\n(说错了发「撤回」; 睡前跟我说声「晚安」, 我给今天收个尾 🌙; 全部用法发「帮助」)";
const NUDGE_LIFETIME_MAX = 3;

const UNDO_EMPTY_REPLY = "今天还什么都没说呢, 没东西可撤哦";
const FINALIZE_EMPTY_REPLY = "今天还没记东西呢~ 想记什么直接发";
const FINALIZE_FAIL_REPLY = "⚠️ 收尾标记没写上! 写入出了问题, 等一会儿再试";
// 跨天后的第一条: 昨天已自动封存的告知(会替掉 FIRST_OF_DAY_PREFIX, 两句语义重复)
const GRACE_EXPIRED_NOTICE = "(昨天的已自动收尾, 翻开新的一页 📖)";
// 共用模式(#15): 文件是用户的每日笔记, 开页语/跨天语带逻辑日日期——凌晨落进"昨天"的文件时一眼能看出
function firstOfDayPrefixShared(day, heading) { return "今天的第一条记录, 记进 " + day + " 的每日笔记「" + heading + "」一节了 📖\n"; }
const FIRST_OF_DAY_PREFIX_SHARED_RE = /^今天的第一条记录, 记进 \d{4}-\d{2}-\d{2} 的每日笔记「[\s\S]*?」一节了 📖\n/;
function stripFirstPrefix(reply) { return String(reply || "").replace(FIRST_OF_DAY_PREFIX, "").replace(FIRST_OF_DAY_PREFIX_SHARED_RE, ""); }
function expiredNoticeShared(day) { return "(" + day + " 的已自动收尾 📖)"; }
const UNDO_FOREIGN_REPLY = "这个文件里没有微信记的内容可撤, 要删请到 Obsidian 里手动删";
function welcomeTextShared(heading) {
  return `嗨~ 我是你的随手记 Agent ✍️

想记什么直接发给我, 文字、语音、图片、文件都行, 我会记到你今天的笔记里。
记的东西在你每天的每日笔记里, 「${heading}」这一节; 想换地方: Obsidian 设置 → 第三方插件 → WeChat Diary。
说错了发「撤回」, 随时发「帮助」看全部用法。`;
}
function helpText(shared, heading, dayStartHour) {
  let t = HELP_TEXT;
  const h = Number(dayStartHour);
  // 「一天从几点开始」改过的用户, 帮助里那句不能还写死 4 点(默认 4 时输出与常量逐字相同)
  if (h === 0) t = t.replace("熬夜不怕跨天: 凌晨 4 点前记的都算前一天。", "一天从零点切换(设置里改的), 不做熬夜合并。");
  else if (Number.isInteger(h) && h !== 4) t = t.replace("凌晨 4 点前记的都算前一天", "凌晨 " + h + " 点前记的都算前一天");
  if (!shared) return t;
  return t + "\n\n「" + heading + "」这一节归插件管: 撤回、段数都只看这一节; 节下面写任何标题就算节结束。";
}

// 撤回回执带被撤内容预览: 用户要能确认撤对了。纯字符串, 不需要 AI。
function undoOkReply(removed) {
  if (!removed) return "好的, 帮你撤回啦";
  if (/\[\[[^\]\n]+\|🔖\s/.test(removed)) return "好的, 撤掉了刚才那条网页，剪藏文件还在";
  if (removed.startsWith("🎤 ![[")) return "好的, 撤掉了刚才那条语音";
  if (removed.startsWith("![[")) {
    const low = removed.toLowerCase();
    if (/\.(mp4|mov|m4v|avi|mkv|webm)\]\]$/.test(low)) return "好的, 撤掉了刚才那个视频";
    if (/\.(jpg|jpeg|png|gif|webp|bmp|heic|avif)\]\]$/.test(low)) return "好的, 撤掉了刚才那张图片";
    return "好的, 撤掉了刚才那个文件";
  }
  const t = removed.replace(/^🎤 /, "").replace(/\n+/g, " ").trim();
  const arr = [...t];
  return "好的, 撤掉了「" + arr.slice(0, 12).join("") + (arr.length > 12 ? "…" : "") + "」";
}

function randomClosing(name) {
  const night = isNightNow();
  const namePool = night ? CLOSING_WITH_NAME_NIGHT : CLOSING_WITH_NAME_DAY;
  const linePool = night ? CLOSING_LINES_NIGHT : CLOSING_LINES_DAY;
  const byePool = night ? CLOSING_FAREWELL_NIGHT : CLOSING_FAREWELL_DAY;
  let head;
  if (name && Math.random() < 0.3) head = randomChoice(namePool).split("{name}").join(name);
  else head = randomChoice(linePool);
  return head + "\n\n" + randomChoice(byePool);
}

// 告别语(晚安/我睡了/今天就到这/明天见)的回复: 回以同类, 不走「结束」的仪式池——
// 说晚安想得到的是一句晚安; 段数就是句号("今天 N 段都收好了", pingReply 同款, 不算回顾)。
// r = finalizeDay 的三态结果; 空日子 / 已封存无补记 → 只道别, 不接"想记什么直接发"。
const SIGNOFF_SEALED_NIGHT = ["晚安 🌙 今天 {n} 段都收好了, 明天见", "好梦 🌙 今天的 {n} 段都收好了, 明天见"];
const SIGNOFF_SEALED_NIGHT_NAME = ["晚安, {name} 🌙 今天 {n} 段都收好了, 明天见"];
const SIGNOFF_SEALED_DAY = ["好~ 今天 {n} 段都收好了 📖 明天见 👋", "今天 {n} 段都收好了 📖 下次见 👋"];
// 只有一段时"1 段都收好了"不通顺, 单独一套
const SIGNOFF_SEALED_NIGHT_ONE = ["晚安 🌙 今天这一段收好了, 明天见", "好梦 🌙 今天的这一段收好了, 明天见"];
const SIGNOFF_SEALED_NIGHT_NAME_ONE = ["晚安, {name} 🌙 今天这一段收好了, 明天见"];
const SIGNOFF_SEALED_DAY_ONE = ["好~ 今天这一段收好了 📖 明天见 👋", "今天这一段收好了 📖 下次见 👋"];
const SIGNOFF_ALREADY_NIGHT = "嗯, 补的也收好了, 晚安 🌙";
const SIGNOFF_ALREADY_DAY = "嗯, 补的也收好了, 明天见 👋";
const SIGNOFF_ONLY_NIGHT = "晚安 🌙 明天见";
const SIGNOFF_ONLY_DAY = "好~ 明天见 👋";
function fillTemplate(t, vars) {
  let out = t;
  for (const k of Object.keys(vars)) out = out.split("{" + k + "}").join(String(vars[k]));
  return out;
}
function signoffReply(det, r, name, now) {
  const night = !!(det && det.bedtime) || isNightNow(now);
  if (!r || r.status === "error") return FINALIZE_FAIL_REPLY;
  if (r.status === "sealed") {
    const one = r.n === 1;
    let pool = night ? (one ? SIGNOFF_SEALED_NIGHT_ONE : SIGNOFF_SEALED_NIGHT) : (one ? SIGNOFF_SEALED_DAY_ONE : SIGNOFF_SEALED_DAY);
    if (night && name && Math.random() < 0.3) pool = one ? SIGNOFF_SEALED_NIGHT_NAME_ONE : SIGNOFF_SEALED_NIGHT_NAME;
    return fillTemplate(randomChoice(pool), { n: r.n, name: name || "" });
  }
  if (r.status === "already" && r.afterSeal > 0) return night ? SIGNOFF_ALREADY_NIGHT : SIGNOFF_ALREADY_DAY;
  return night ? SIGNOFF_ONLY_NIGHT : SIGNOFF_ONLY_DAY;
}

// 夜间收尾提示的决策(纯函数, 表驱动可测): 写成功且当天未封存、用户从没手动收尾过、
// 终身提示 <3 次、现在是深夜、今天还没提示过 → 给一句。
function nightSignoffTip(ctx) {
  if (!ctx || !ctx.n || ctx.sealed) return null;
  if ((ctx.finalizeCount || 0) > 0) return null;
  if ((ctx.nudgeCount || 0) >= NUDGE_LIFETIME_MAX) return null;
  if (!isLateNight(ctx.now)) return null;
  if (ctx.nudgedDate && ctx.nudgedDate === logicalTodayStr(ctx.now)) return null;
  return NIGHT_SIGNOFF_TIP;
}

// ── 意图识别(019 intents.py 移植 + 020「误切换吃内容」修复)──────────────

const INTENT = { DIARY: "DIARY", FINALIZE: "FINALIZE", UNDO: "UNDO", HELP: "HELP", CHAT: "CHAT", START_DIARY: "START_DIARY" };

const MAX_COMMAND_LEN = 15;
const FINALIZE_KEYWORDS = new Set([
  "结束", "收尾", "收工", "打烊", "归档",
  // 完成态(2026-08-19): 「结束了」「记完了」是用户真会说的收尾话。「写完了」不收——待办用户拿它记完成状态。
  // 019 传下来的光杆「完了」于 2026-08-19 移出: 它更常是感叹(「完了完了」「完了😭」), 尾部剥 emoji/复读折叠
  // 上线后必被误吞; 标准同下: 可能是内容就不收。想收尾说「结束」。
  "结束了", "记完了", "今天记完了", "说完了", "今天结束", "今天就结束",
]);
// 告别语=收尾(2026-08-19 谷雨拍板): 只收明确是对 bot 说的(第一人称/带「今天」/对话式)。光杆「睡了」「睡觉了」
// 「先这样」「就这样」「到此为止」「拜拜」「再见」都不收——记爸妈病历/宝宝作息的用户会拿前两个当状态记,
// 后几个可能是情绪句; 标准同「在吗」: 可能是内容就不收。想把「晚安」当内容记: 「记：晚安」。
// 「X啦」= 「X了」的合音, 匹配时等价处理(见 detectIntent), 不必在表里重复列。
const BEDTIME_KEYWORDS = new Set([
  "晚安", "晚安了", "我睡了", "我去睡了", "去睡了", "去睡觉了", "睡觉去了", "我睡觉去了", "我去睡觉了", "我睡觉了",
  "我要睡了", "我要睡觉了", "我先睡了", "我先去睡了", "我该睡了", "晚安明天见",
]);
const SIGNOFF_KEYWORDS = new Set([
  ...BEDTIME_KEYWORDS,
  "今天就到这", "今天就到这里", "今天就到这儿", "今天先到这", "今天先到这里", "今天先到这儿",
  "明天见",
]);
const UNDO_KEYWORDS = new Set(["撤回", "删掉", "删除", "撤销", "删掉上一段", "删掉上条", "撤回上一段"]);
// 「撤回/撤销/删掉/删除」开头放行的尾巴: 复读(语音「撤回撤回撤回这一段」)与指代。「撤回申请」「撤销订阅」
// 「删掉了一些旧照片」是内容, 必须照记——误记能撤, 误删救不回(2026-08-19 收紧, 原先 startsWith 全放行)。
const UNDO_TAILS = new Set([
  "", "一下", "下", "掉", "一条", "一段", "上一条", "上一段", "上条", "上一句", "上一个", "这一段", "这段", "这条", "这句", "这个",
  "那条", "那段", "那个", "上面", "上面的", "上面那条", "上面那段", "上面那句", "上面那个",
  "刚才", "刚刚", "刚才的", "刚刚的", "刚才发的", "刚刚发的", "刚发的", "刚才那条", "刚才那段", "刚才那句", "刚才那个",
  "刚才这条", "刚刚那条", "刚刚那段", "刚刚那个", "最后一条", "最后一段", "最后那条", "前一条", "前一段",
]);
// 前置应答词(「好，结束」「嗯 撤回」「那结束吧」「OK 结束」「好结束」「好的好的晚安」): 最多剥 3 层, 剥掉后只做
// 词表精确匹配, 不走任何前缀兜底——「好早」「那完了」「好的撤销了订单」都留在内容侧。长的在前(正则按顺序取)。
const LEAD_ACK_RE = /^(好的呀|好的|好了|好啦|好吧|好嘞|好呀|好啊|好哦|好哈|好滴|嗯呐|嗯+|那就|那|好+|行+|okay|ok)([,，。.!！?？~～、\s]*)/;
const LEAD_ACK_MAX = 3;
// 多段告别(「晚安 晚安」「晚安，明天见」「结束 晚安」): 按分隔符切段, 每段都得是收尾/告别词才算
const SEGMENT_SEP_RE = /[,，、;；。.!！?？~～\s]+/;
// 「记：xx」逃生口: xx 原样落库, 不管它是不是命令词(与「撤回」对称: 一个救误记, 一个救误吞)
const FORCE_RECORD_RE = /^记[：:]\s*/;
const HELP_KEYWORDS = new Set(["/help", "help", "帮助", "怎么用", "使用说明", "菜单"]);
// 探活/寒暄词表: 这些是 ping, 不是内容——回状态、不落库(v0.3.0 单模式下的关键闸门)
const CHAT_GREETING_KEYWORDS = new Set([
  "你好", "您好", "嗨", "hi", "hello", "hihi", "halo", "哈喽", "哈罗",
  "在吗", "在么", "在不在", "在嘛", "你在吗", "你在么", "你在不在", "喂",
  "我来啦", "我来了", "来啦", "我来",
  "早", "早安", "早上好", "中午好", "下午好", "晚上好",
  "测试", "test", "试试", "试一下",
]);
const START_DIARY_KEYWORDS = new Set([
  "开始记日记", "开始记录", "记日记", "开始", "开始写",
  "我要记日记", "我要写日记", "我要记录",
  "可以记日记吗", "可以开始吗", "记一下",
]);
// 故意不含单字「开始」, 避免「今天工作开始得很早」误触发
const START_DIARY_PHRASES = ["开始记日记", "开始记录", "开始写日记", "我们记日记"];
// 「结束」之后用户会宣告「继续记录」(2026-08-19 谷雨实测第一反应)——和「开始记日记」同类:
// 对 bot 说的话, 不是内容。只收光杆短句; 「明天继续记录血压」是内容(精确匹配, 不做包含判断)。
const CONTINUE_KEYWORDS = new Set([
  "继续", "继续记", "继续记录", "继续写", "继续记日记", "继续写日记",
  "接着记", "接着记录", "接着写", "我要继续记", "我继续记",
]);

// 半角+全角都要有(2026-08-19 修: 原来两组都是半角, 「叫我小明！」会把感叹号存进名字)
const STRIP_CHARS = new Set([..."。!?！？,，、;；:：~～ \t\n　"]);
const TAIL_PARTICLES = ["吧", "啊", "啦", "呀", "哦", "嘛", "呗", "哈", "咯", "喽", "呐", "哟", "呢"];

function rstripChars(s, charSet) {
  const arr = [...s];
  let end = arr.length;
  while (end > 0 && charSet.has(arr[end - 1])) end--;
  return arr.slice(0, end).join("");
}

// 尾部噪音: 标点、符号、emoji(「晚安🌙」「撤回❌」「结束。。」都要认); 头部只剥引号括号与 emoji(「结束」「🌙晚安」)。
// 不用 /[…]+$/ 正则(长符号串上是二次方回溯), 逐码点回退, 线性。书名号《》不剥: 「《晚安》」是在记一首歌。
const NOISE_CH_RE = /^[\p{P}\p{S}\p{Extended_Pictographic}️‍\s]$/u;
const LEAD_STRIP_CH_RE = /^[「『【"'“‘（(\[\s\p{Extended_Pictographic}️‍]$/u;
function stripNoise(s) {
  const arr = [...rstripChars(s, STRIP_CHARS)];
  let end = arr.length;
  while (end > 0 && NOISE_CH_RE.test(arr[end - 1])) end--;
  let start = 0;
  while (start < end && LEAD_STRIP_CH_RE.test(arr[start])) start++;
  return arr.slice(start, end).join("");
}

function normalizeIntent(text) {
  let s = (text || "").trim().split("　").join(" ");
  s = stripNoise(s).trimStart().toLowerCase();
  // 循环剥尾部语气词: 语气词后可能还有标点(「开始记日记吧。」)
  for (;;) {
    let changed = false;
    for (const p of TAIL_PARTICLES) {
      if (s.length > p.length && s.endsWith(p)) { s = s.slice(0, s.length - p.length); changed = true; break; }
    }
    s = stripNoise(s);
    if (!changed) break;
  }
  return s;
}

// 一个短句的各种"等价形态", 词表查找时都试一遍(纯查表, 不做前缀匹配):
//   norm(剥噪音+尾部语气词) / base(只剥噪音, 保住「在嘛」「来啦」这种词本身带语气字的) / 各自的复读折叠 /
//   「X啦」→「X了」(「我睡啦」=「我睡了」)。返回去重后的候选数组。
function intentForms(raw) {
  const norm = normalizeIntent(raw);
  const base = stripNoise((raw || "").trim().split("　").join(" ")).trimStart().toLowerCase();
  const forms = new Set([norm, base, foldRepeats(norm), foldRepeats(base)]);
  const la = base.endsWith("啦") && !norm.endsWith("啦"); // 「我睡啦」: 尾部「啦」被当语气词剥掉了, 补一个「了」形态
  if (la) forms.add(norm + "了");
  forms.delete("");
  return { norm, base, la, forms: [...forms] };
}
function hitAny(set, forms) { return forms.some((f) => set.has(f)); }

// 返回 { intent, suspect?, signoff?, bedtime?, forced?, viaAck? }:
// signoff=告别语触发的 FINALIZE(回复走 signoffReply); bedtime=睡觉类(晚安池);
// forced=「记：」逃生口(写入方剥前缀原样落库); viaAck=靠剥前置应答词/多段拼接才命中(仅供测试/日志)。
function detectIntent(text) {
  const raw = (text || "").trim();
  if (!raw) return { intent: INTENT.DIARY };
  if (FORCE_RECORD_RE.test(raw)) return { intent: INTENT.DIARY, forced: true };
  const cp = codePointLen(raw);
  if (START_DIARY_PHRASES.some((p) => raw.includes(p))) {
    if (cp <= MAX_COMMAND_LEN || START_DIARY_KEYWORDS.has(normalizeIntent(raw))) return { intent: INTENT.START_DIARY };
    return { intent: INTENT.START_DIARY, suspect: true };
  }
  // 长度闸门按剥完噪音的正文算: 「撤回！！！！！！！！！！！！！！」「晚安🌙🌙🌙」仍是命令
  if (cp > MAX_COMMAND_LEN * 4) return { intent: INTENT.DIARY };
  const { norm, la, forms } = intentForms(raw);
  if (codePointLen(norm) > MAX_COMMAND_LEN) return { intent: INTENT.DIARY };
  const r = matchCommand(forms, norm);
  if (r) return r;
  // 前置应答词剥壳: 「好，结束」「嗯 撤回」「那结束吧」「好的好的晚安」——最多剥 3 层, 每层剥后 rest 非空,
  // 只做精确匹配, 不走任何前缀兜底。探活(在吗/早)只在带分隔符时可达: 「好，早」是招呼, 「好早」是内容。
  let rest = norm, sep = false;
  for (let i = 0; i < LEAD_ACK_MAX; i++) {
    const m = LEAD_ACK_RE.exec(rest);
    if (!m || m[0].length >= rest.length) break;
    rest = rest.slice(m[0].length);
    if (m[2]) sep = true;
    const restForms = [rest, foldRepeats(rest)];
    if (la) restForms.push(rest + "了"); // 「那我睡啦」
    const rr = matchCommand(restForms, rest, { viaAck: true, allowChat: sep });
    if (rr) return rr;
  }
  // 多段告别: 「晚安 晚安」「晚安，明天见」「结束 晚安」「好了，晚安，明天见」「我睡了晚安」——
  // 切段后每段都得能被收尾/告别词表切干净, 总词数 ≥2 才算; 任何一段有词表外的字(「晚安 宝贝」)就是内容
  const segs = norm.split(SEGMENT_SEP_RE).filter(Boolean);
  if (segs.length >= 1 && segs.length <= 4) {
    if (segs.length >= 2 && LEAD_ACK_RE.exec(segs[0]) && LEAD_ACK_RE.exec(segs[0])[0].length === segs[0].length) segs.shift();
    const tokens = [];
    let ok = true;
    for (const seg of segs) {
      const t = tokenizeClosing(seg);
      if (!t) { ok = false; break; }
      tokens.push(...t);
    }
    if (ok && tokens.length >= 2) {
      const so = tokens.some((x) => SIGNOFF_KEYWORDS.has(x));
      const bt = tokens.some((x) => BEDTIME_KEYWORDS.has(x));
      return so ? { intent: INTENT.FINALIZE, signoff: true, bedtime: bt, viaAck: true } : { intent: INTENT.FINALIZE, viaAck: true };
    }
  }
  return { intent: INTENT.DIARY };
}

// 把一段话切成收尾/告别词(贪心最长匹配, 词间允许语气词/噪音字符); 切不干净返回 null。
// 「我睡了晚安」→ ["我睡了","晚安"]; 「晚安啦晚安啦」→ ["晚安","晚安"]; 「晚安宝贝」→ null。词表里的「X了」也接受「X啦」。
let _closingVocab = null;
function closingVocab() {
  if (!_closingVocab) {
    const words = new Set([...FINALIZE_KEYWORDS, ...SIGNOFF_KEYWORDS]);
    for (const w of [...words]) if (w.endsWith("了")) words.add(w.slice(0, -1) + "啦");
    _closingVocab = [...words].sort((a, b) => codePointLen(b) - codePointLen(a));
  }
  return _closingVocab;
}
function tokenizeClosing(seg) {
  const arr = [...seg];
  const out = [];
  let i = 0;
  while (i < arr.length) {
    let hit = null;
    for (const w of closingVocab()) {
      const wl = codePointLen(w);
      if (arr.slice(i, i + wl).join("") === w) { hit = w; break; }
    }
    if (hit) { out.push(hit.endsWith("啦") ? hit.slice(0, -1) + "了" : hit); i += codePointLen(hit); continue; }
    if (out.length && (TAIL_PARTICLES.includes(arr[i]) || NOISE_CH_RE.test(arr[i]))) { i++; continue; } // 词间语气词/噪音
    return null;
  }
  return out.length ? out : null;
}

// 词表精确匹配(所有命令共用一套): forms 是候选形态, norm 给 isUndoPhrase 用
function matchCommand(forms, norm, opts) {
  const o = opts || {};
  const tag = (r) => (o.viaAck ? Object.assign(r, { viaAck: true }) : r);
  if (hitAny(FINALIZE_KEYWORDS, forms)) return tag({ intent: INTENT.FINALIZE });
  if (hitAny(SIGNOFF_KEYWORDS, forms)) return tag({ intent: INTENT.FINALIZE, signoff: true, bedtime: hitAny(BEDTIME_KEYWORDS, forms) });
  if (hitAny(UNDO_KEYWORDS, forms) || forms.some(isUndoPhrase)) return tag({ intent: INTENT.UNDO });
  if (hitAny(HELP_KEYWORDS, forms)) return tag({ intent: INTENT.HELP });
  if (!o.viaAck && START_DIARY_KEYWORDS.has(norm)) return { intent: INTENT.START_DIARY };
  if (!o.viaAck && CONTINUE_KEYWORDS.has(norm)) return { intent: INTENT.START_DIARY, cont: true };
  if ((!o.viaAck || o.allowChat) && hitAny(CHAT_GREETING_KEYWORDS, forms)) return tag({ intent: INTENT.CHAT });
  return null;
}

// 「撤回/撤销/删掉/删除」开头: 复读或带指代尾巴才是命令(「撤回撤回撤回这一段」「撤销一下」「删掉刚才那条」);
// 「撤回申请」「撤销订阅」「撤回来了」「删掉了一些旧照片」是内容
function isUndoPhrase(norm) {
  const m = /^(?:(?:撤回|撤销|删掉|删除)[吧啊啦呀哦嘛]?)+/.exec(norm);
  if (!m) return false;
  return UNDO_TAILS.has(norm.slice(m[0].length));
}

// ── 取名规则引擎(019 names.py 移植)─────────────────────────────────────

const CALL_ME_MARKERS = ["叫我", "喊我", "称呼我", "称我"];
const CLAUSE_SPLIT_RE = /[。．.!！?？,，;；、\n]/;
const REFUSALS = new Set([
  "不用", "不用了", "不需要", "不必", "随便", "随意", "都行", "都可以",
  "无所谓", "算了", "跳过", "不想说", "保密", "没有", "不告诉你",
  "你随便", "随便你", "你定", "你看着办", "不取了", "不用取",
]);
const INTERROGATIVES = ["什么", "啥", "谁", "怎么", "为什么", "哪", "如何", "几点"];
const QUESTION_SUFFIXES = ["干嘛", "干什么", "干啥", "做什么", "做甚"];
const NON_NAMES = new Set([
  "好", "好的", "好呀", "好啊", "行", "可以", "嗯", "嗯嗯", "哦", "噢", "喔",
  "是", "对", "什么", "啥", "为什么", "怎么", "怎么办", "谢谢", "多谢",
  "干", "干嘛", "干什么", "干啥", "名字", "什么名字", "比较好",
  "起床", "吃饭", "睡觉", "上班", "下班", "开会", "加班", "帮忙",
  "说两句", "说话", "想想", "看看", "加油",
]);
const RENAME_PREFIXES = new Set([
  "", "请", "就", "你", "您", "你就", "您就", "那就", "以后", "以后就",
  "以后请", "以后你就", "改成", "改口", "还是", "重新",
]);
const NAME_LEAD_PHRASES = ["那就叫", "就叫我", "就叫", "那就", "就", "那", "嗯", "呃", "唔"];
const NAME_TAIL_COURTESY = [
  "就可以了", "就行了", "就好了", "就可以", "就行", "就好", "就成", "好了",
  "怎么样", "可以吗", "行不行", "好不好", "都可以", "行吗", "好吗", "都行", "如何",
];
const NAME_TAIL_PARTICLES = new Set([..."吧呗啦哟哦呀嘛呢咯喽吗么嗯"]);
const NAME_FUNCTION_CHARS = [..."的了是在去到给帮"];

function cleanName(s) {
  return rstripChars((s || "").trim(), STRIP_CHARS).trim();
}

function validateName(candidate) {
  let s = (candidate || "").trim();
  if (!s) return null;
  // 取到第一个分句标点为止
  s = s.split(CLAUSE_SPLIT_RE)[0].trim();
  if (!s) return null;
  // 反问后缀与疑问词必须在剥语气词之前判(「什么都行」剥「么」会逃检)
  if (QUESTION_SUFFIXES.some((q) => s.endsWith(q))) return null;
  if (INTERROGATIVES.some((q) => s.includes(q))) return null;
  // 剥头部引导短语(长在前)
  for (;;) {
    const hit = NAME_LEAD_PHRASES.find((p) => s.length > p.length && s.startsWith(p));
    if (!hit) break;
    s = s.slice(hit.length).trim();
  }
  // 剥尾部客套(长在前)
  for (;;) {
    const hit = NAME_TAIL_COURTESY.find((p) => s.length > p.length && s.endsWith(p));
    if (!hit) break;
    s = s.slice(0, s.length - hit.length).trim();
  }
  // 剥尾部语气词, 剥后必须还有内容(保护「小哈」这类名字)
  for (;;) {
    const arr = [...s];
    if (arr.length > 1 && NAME_TAIL_PARTICLES.has(arr[arr.length - 1])) s = arr.slice(0, -1).join("");
    else break;
  }
  s = s.trim();
  const n = codePointLen(s);
  if (n < 1 || n > NAME_MAX_LEN) return null;
  if (NON_NAMES.has(s) || REFUSALS.has(s)) return null;
  // 命令词/招呼词(帮助/结束/开始/你好...)不能当名字
  if (detectIntent(s).intent !== INTENT.DIARY) return null;
  return s;
}

// 整句复读折叠(语音转写「就叫谷雨吧就叫谷雨吧」); 单元长度≥2, 叠字昵称不折叠
function foldRepeats(text) {
  const arr = [...text];
  const n = arr.length;
  for (let u = 2; u <= Math.floor(n / 2); u++) {
    if (n % u !== 0) continue;
    const unit = arr.slice(0, u).join("");
    if (unit.repeat(n / u) === text) return unit;
  }
  return text;
}

function lastMarkerHit(text) {
  let best = null;
  for (const marker of CALL_ME_MARKERS) {
    let idx = text.lastIndexOf(marker);
    if (idx >= 0 && (best === null || idx > best.idx)) best = { idx, marker };
  }
  return best;
}

// chat 模式改名(严得多: 误改名代价 > 漏识别)
function extractExplicitName(text) {
  text = (text || "").trim();
  if (!text || codePointLen(text) > 15) return null;
  const hit = lastMarkerHit(text);
  if (!hit) return null;
  const prefix = cleanName(text.slice(0, hit.idx));
  if (!RENAME_PREFIXES.has(prefix)) return null;
  const candidate = text.slice(hit.idx + hit.marker.length);
  const cleaned = cleanName(candidate);
  if (NAME_FUNCTION_CHARS.some((c) => [...cleaned].includes(c))) return null; // 是句子不是名字
  const nm = validateName(candidate);
  // 称呼 ≤4 字(小明/豆妈/小可爱都够): 「叫我妈过来吃饭」这类短句是内容, 超长一律照记(审稿轮抓出)
  if (nm && codePointLen(nm) > 4) return null;
  return nm;
}

// ── AI 调用(OpenAI 兼容; 走 requestUrl, 与 iLink 直连策略相反, 代理友好)──

const POLISH_PROMPT = `你是日记助理。用户刚说了一段话(可能是语音转写,有口语痕迹)。
请轻度润色:去掉"嗯""那个""这个"这类语气词,理顺断句;需要分行时用单个换行,不要留空行。
禁止:改变第一人称、改写语义、加入用户没说的内容、做总结或点评。
保留用户的表达风格和情绪。

用户原话:
{raw_text}

直接输出润色后的文本,不要任何前缀说明。`;

const CHAT_SYSTEM_PROMPT = `你是日记 Agent 在闲聊模式下的助手。用户当前不在记录日记的状态, 你陪用户随便聊聊。

关键约束:
- 每次回复短小 (≤50 字), 像朋友闲聊
- 不主动写日记, 因为你不在记录模式
- 当用户明显在描述今天发生的事时, 柔和提醒: "想记下来吗? 发『开始记日记』就开始"
- 保持温暖陪伴语气, 不长篇大论
- 不评判, 不给建议, 不点评

绝对禁止 (违反会欺骗用户造成混淆):
- 你没有切换模式的能力, 切换由代码层面自动处理, 不归你管
- 绝不要说"已切换到日记模式"、"现在是日记模式"、"切换回闲聊模式"、"咱们继续日记模式"等任何宣称模式状态的表达
- 用户问你现在是什么模式时, 老实回"我这边只是闲聊, 想记日记发『开始记日记』就开始"
- 想引导用户切换时只能说: "想记的话发『开始记日记』就开始 📖", 绝不冒充"已经切了"

不要做的:
- 不要装专家
- 不要总结、点评
- 不要超过 2 句话`;

const CHAT_FALLBACK_REPLIES = ["嗯~ 我在听呢", "好的, 慢慢说", "嗯嗯", "在的, 继续说", "我都听着"];

const NAME_LLM_PROMPT = `用户被问「你希望我叫你什么名字」, 用户回答:
{reply}

从回答中提取用户希望被称呼的名字, 只输出名字本身 (不超过 10 个字), 不要任何解释。
如果回答里没有名字、或用户表示不想要称呼, 只输出一个字: 无`;

// 【宿主适配】auth 一条: .env 概念改为插件设置
const NET_NOTE_BY_KIND = {
  auth: " (AI Key 好像不对呢, 检查下插件设置, 原文已存)",
  balance: " (AI 余额用完啦, 充值后试试, 原文已存)",
  rate_limit: " (AI 调用太频繁, 原文已存)",
  network: " (AI 暂时不通, 原文已存)",
  server: " (AI 服务异常, 原文已存)",
  other: " (AI 出了点小问题, 原文已存)",
  no_key: " (没配 AI Key, 原文已存)",
};

class AiClient {
  constructor(plugin) { this.plugin = plugin; }

  ready() {
    const s = this.plugin.settings;
    return Boolean(s.aiApiUrl && s.aiModel && this.plugin.getAiKey());
  }

  // 返回 content 字符串; 失败抛 {kind, message}
  async chatCompletion(messages, temperature, timeoutMs) {
    const s = this.plugin.settings;
    const key = this.plugin.getAiKey();
    if (!this.ready()) { const e = new Error("no_key"); e.kind = "no_key"; throw e; }
    const call = requestUrl({
      url: s.aiApiUrl,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: s.aiModel, messages, temperature, stream: false }),
      throw: false,
    });
    let res;
    try {
      res = await Promise.race([
        call,
        new Promise((_, rej) => window.setTimeout(() => { const e = new Error("timeout"); e.kind = "network"; rej(e); }, timeoutMs || 30000)),
      ]);
    } catch (err) {
      const e = new Error(String(err && err.message || err)); e.kind = err.kind || "network"; throw e;
    }
    const status = res.status;
    if (status < 200 || status >= 300) {
      const e = new Error("HTTP " + status);
      e.kind = status === 401 ? "auth" : status === 402 ? "balance" : status === 429 ? "rate_limit" : status >= 500 ? "server" : "other";
      throw e;
    }
    let data;
    try { data = res.json; } catch (err) { const e = new Error("bad json"); e.kind = "other"; throw e; }
    try {
      return String(data.choices[0].message.content || "").trim();
    } catch (err) { const e = new Error("bad shape"); e.kind = "other"; throw e; }
  }

  // 润色。返回 { text, usedLlm, kind } —— 零 key 是正常形态不是错误。
  async polish(rawText) {
    rawText = (rawText || "").trim();
    if (!rawText) return { text: rawText, usedLlm: false, kind: null };
    if (!this.ready()) return { text: rawText, usedLlm: false, kind: null };
    try {
      const out = await this.chatCompletion(
        [{ role: "user", content: POLISH_PROMPT.split("{raw_text}").join(rawText) }], 0.3, 15000);
      if (out) return { text: out, usedLlm: true, kind: null };
      return { text: rawText, usedLlm: false, kind: "other" };
    } catch (e) {
      return { text: rawText, usedLlm: false, kind: e.kind || "other" };
    }
  }

  async llmExtractName(reply) {
    if (!this.ready()) return null;
    try {
      const out = await this.chatCompletion(
        [{ role: "user", content: NAME_LLM_PROMPT.split("{reply}").join(reply) }], 0.3, 10000);
      if (!out || out === "无" || out.toLowerCase() === "none") return null;
      return validateName(out);
    } catch (e) { return null; }
  }
}

// 闲聊(带 5 轮内存历史, 不持久化)。
// ⚠️ v0.3.0 起单模式不再有调用点——代码按谷雨要求保留, 待"AI 怎么融进 Agent"想清楚再启用。
class ChatHandler {
  constructor(ai) { this.ai = ai; this.history = []; }
  resetHistory() { this.history = []; }
  async chat(text) {
    if (!this.ai.ready()) return "想记什么直接发就行 ✍️";
    const messages = [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...this.history, { role: "user", content: text }];
    let reply;
    try {
      reply = await this.ai.chatCompletion(messages, 0.7, 15000);
      if (!reply) reply = randomChoice(CHAT_FALLBACK_REPLIES);
    } catch (e) {
      reply = randomChoice(CHAT_FALLBACK_REPLIES);
    }
    this.history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    while (this.history.length > 10) this.history.shift();
    return reply;
  }
}

// ── 网页正文剪藏(纯本地规则, 不调用 AI)──────────────────────────────────

const WEB_CLIP_FETCH_TIMEOUT_MS = 30000;
const WEB_CLIP_IMAGE_TIMEOUT_MS = 10000;
const WEB_CLIP_TOTAL_BUDGET_MS = 75000;
const WEB_CLIP_IMAGE_CONCURRENCY = 4;
const WEB_CLIP_MAX_HTML_BYTES = 5 * 1024 * 1024;
const WEB_CLIP_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const WEB_CLIP_DEFAULT_MAX_IMAGES = 30;
const WEB_CLIP_HARD_MAX_IMAGES = 100;
const WEB_CLIP_DEFAULT_MAX_TOTAL_IMAGE_MB = 50;
const WEB_CLIP_MIN_TOTAL_IMAGE_MB = 15;
const WEB_CLIP_HARD_MAX_TOTAL_IMAGE_MB = 500;
const WEB_CLIP_MAX_LINKS_PER_MESSAGE = 3;
const WEB_CLIP_MIN_TEXT_CHARS = 40;
const WEB_URL_RE = /https?:\/\/[^\s<>"'，。！？；：、（）【】《》「」『』〔〕〈〉]+/gi;
const WEB_CLIP_BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

function defaultWebClipFolder(settings) {
  return normalizePath(((settings && settings.diaryFolder) || "日记") + "/剪藏");
}

function webClipMaxImages(settings) {
  const configured = Number(settings && settings.webClipMaxImages);
  return Number.isFinite(configured)
    ? Math.max(0, Math.min(WEB_CLIP_HARD_MAX_IMAGES, Math.floor(configured)))
    : WEB_CLIP_DEFAULT_MAX_IMAGES;
}

function webClipMaxTotalImageBytes(settings) {
  const configured = Number(settings && settings.webClipMaxTotalImageMb);
  const mb = Number.isFinite(configured)
    ? Math.max(WEB_CLIP_MIN_TOTAL_IMAGE_MB, Math.min(WEB_CLIP_HARD_MAX_TOTAL_IMAGE_MB, Math.floor(configured)))
    : WEB_CLIP_DEFAULT_MAX_TOTAL_IMAGE_MB;
  return mb * 1024 * 1024;
}

function normalizeWebUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    u.hash = ""; // 页面锚点不影响正文, 去掉后同一篇文章可稳定去重
    return u.toString();
  } catch (e) { return null; }
}

function isWechatArticleUrl(raw) {
  const normalized = normalizeWebUrl(raw);
  if (!normalized) return false;
  try { return new URL(normalized).hostname.toLowerCase() === "mp.weixin.qq.com"; }
  catch (e) { return false; }
}

function shouldClipWebUrl(raw, settings) {
  return isWechatArticleUrl(raw) || Boolean(settings && settings.webClipOtherSites === true);
}

function trimUrlTail(raw) {
  let s = String(raw || "");
  // 中文闭合标点和句末标点不会是 URL 的合法必要尾巴。
  s = s.replace(/[，。！？；：、）】》」』〕〉]+$/g, "");
  s = s.replace(/[.,!?;:]+$/g, "");
  // 英文右括号只有在数量多于左括号时才当聊天标点剥掉, 保住 Wikipedia 常见的 (...) URL。
  while (s.endsWith(")") && (s.match(/\)/g) || []).length > ((s.match(/\(/g) || []).length)) s = s.slice(0, -1);
  return s;
}

function extractWebUrls(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text || "").matchAll(WEB_URL_RE)) {
    const u = normalizeWebUrl(trimUrlTail(m[0]));
    if (u && !seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out;
}

function linkNoteFromText(text, urls) {
  let note = String(text || "");
  for (const u of urls || []) {
    // 同时去规范化前后的原串: URL() 可能补尾斜线。
    note = note.split(u).join(" ");
    const noSlash = u.endsWith("/") ? u.slice(0, -1) : u;
    if (noSlash) note = note.split(noSlash).join(" ");
  }
  note = note.replace(WEB_URL_RE, " ").replace(/^[\s，。！？；：、:：-]+|[\s，。！？；：、:：-]+$/g, "");
  return note.replace(/\s+/g, " ").trim();
}

function isPrivateIpv4(host) {
  const p = String(host || "").split(".");
  if (p.length !== 4 || p.some((x) => !/^\d+$/.test(x) || Number(x) > 255)) return false;
  const a = p.map(Number);
  return a[0] === 0 || a[0] === 10 || a[0] === 127 ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && (a[1] === 0 || a[1] === 168)) ||
    (a[0] === 198 && (a[1] === 18 || a[1] === 19)) || a[0] >= 224;
}

function isUnsafeWebUrl(raw) {
  const normalized = normalizeWebUrl(raw);
  if (!normalized) return true;
  const u = new URL(normalized);
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") ||
      h.endsWith(".lan") || h.endsWith(".home.arpa")) return true;
  if (isPrivateIpv4(h)) return true;
  // IPv4-mapped IPv6、loopback、link-local、ULA。
  if (h === "::" || h === "::1" || h.startsWith("::ffff:") || h.startsWith("fe8") || h.startsWith("fe9") ||
      h.startsWith("fea") || h.startsWith("feb") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // 单标签主机名通常是局域网服务。公网域名、IPv6 和 .onion 都有点或冒号。
  if (!h.includes(".") && !h.includes(":")) return true;
  return false;
}

function decodeHtmlEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", copy: "©", reg: "®" };
  return String(text || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (all, key) => {
    if (key[0] === "#") {
      const hex = key[1].toLowerCase() === "x";
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      try { return Number.isFinite(n) ? String.fromCodePoint(n) : all; } catch (e) { return all; }
    }
    return Object.prototype.hasOwnProperty.call(named, key.toLowerCase()) ? named[key.toLowerCase()] : all;
  });
}

function htmlAttr(tag, name) {
  const re = new RegExp("(?:^|\\s)" + name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))", "i");
  const m = re.exec(tag || "");
  return m ? decodeHtmlEntities(m[1] != null ? m[1] : (m[2] != null ? m[2] : m[3])) : "";
}

function metaFromHtml(html, keys) {
  for (const tag of String(html || "").match(/<meta\b[^>]*>/gi) || []) {
    const id = (htmlAttr(tag, "property") || htmlAttr(tag, "name") || htmlAttr(tag, "itemprop")).toLowerCase();
    if (keys.includes(id)) return htmlAttr(tag, "content").trim();
  }
  return "";
}

function absoluteHttpUrl(raw, baseUrl) {
  try {
    const u = new URL(raw, baseUrl);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.toString() : "";
  } catch (e) { return ""; }
}

function cleanMarkdown(md) {
  const codeBlocks = [];
  let source = String(md || "").replace(/\u00a0/g, " ");
  // 先保护插件生成的 fenced code，普通空白清理不能碰代码缩进和空行。
  source = source.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, (block) => {
    const token = "\u0000WEBCLIP_CODE_" + codeBlocks.length + "\u0000";
    codeBlocks.push(block.replace(/^\n|\n$/g, ""));
    return "\n" + token + "\n";
  });
  source = source.split("\n").map((line) => {
    const trimmedEnd = line.replace(/[ \t]+$/g, "");
    // 列表的行首空白是层级，不得抹掉；其它 HTML 排版空白不应变成代码块。
    if (/^[ \t]+(?:[-+*]|\d+[.)])\s/.test(trimmedEnd)) return trimmedEnd;
    return trimmedEnd.replace(/^[ \t]+/g, "").replace(/[ \t]{2,}/g, " ");
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return source.replace(/\u0000WEBCLIP_CODE_(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)] || "").trim();
}

function escapeWebText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/!\[/g, "!\\[")
    .replace(/\[\[/g, "\\[\\[")
    .replace(/\]\]/g, "\\]\\]")
    .replace(/%%/g, "\\%\\%")
    .replace(/(^|\n)([ \t]*)(\d+)([.)])(?=\s)/g, "$1$2$3\\$4")
    .replace(/(^|\n)([ \t]*)(`{3,}|~{3,}|#{1,6}(?=\s)|[-+*](?=\s)|>(?=\s))/g, "$1$2\\$3");
}

// 文本节点分别转义后仍可能在 DOM 边界拼出 ![ 或 [[。这里对最终正文再收口一次；
// 插件自己的图片仍是 %%WECHAT_DIARY_IMAGE_n%% 占位，不会被误伤。
function hardenWebMarkdown(value) {
  return String(value || "")
    .replace(/(^|[^\\])!\[/g, "$1!\\[")
    .replace(/(^|[^\\])\[\[/g, "$1\\[\\[");
}

function fencedWebCode(value) {
  const code = String(value || "").replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
  if (!code) return "";
  let longest = 0;
  for (const m of code.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return "\n\n" + fence + "\n" + code + "\n" + fence + "\n\n";
}

function tableToMarkdown(table) {
  const rows = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll(":scope > th, :scope > td")]
    .map((c) => escapeWebText(c.textContent || "").replace(/\n+/g, " ").trim().replace(/\|/g, "\\|"))).filter((r) => r.length);
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < width) r.push("");
  const out = ["| " + rows[0].join(" | ") + " |", "| " + rows[0].map(() => "---").join(" | ") + " |"];
  for (const r of rows.slice(1)) out.push("| " + r.join(" | ") + " |");
  return "\n\n" + out.join("\n") + "\n\n";
}

function webClipImageToken(index) { return "%%WECHAT_DIARY_IMAGE_" + index + "%%"; }

function srcFromSrcset(srcset) {
  const parts = String(srcset || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return "";
  return parts[parts.length - 1].split(/\s+/)[0] || "";
}

function collectWebClipImage(images, rawUrl, alt, baseUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw || raw === "null" || raw === "undefined" || raw === "#" || raw === "about:blank") return "";
  const url = absoluteHttpUrl(raw, baseUrl);
  if (!url) return "";
  let i = images.findIndex((x) => x.url === url);
  if (i < 0) {
    i = images.length;
    images.push({ url, alt: escapeWebText(alt || "").replace(/\n+/g, " ").replace(/[\[\]]/g, ""), token: webClipImageToken(i) });
  } else if (!images[i].alt && alt) {
    images[i].alt = escapeWebText(alt).replace(/\n+/g, " ").replace(/[\[\]]/g, "");
  }
  return images[i].token;
}

function imageTokenFromDom(node, baseUrl, images) {
  const width = Number(node.getAttribute("width") || 0);
  const height = Number(node.getAttribute("height") || 0);
  if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) return "";
  const raw = node.getAttribute("data-src") || node.getAttribute("data-original") ||
    node.getAttribute("data-lazy-src") || node.getAttribute("data-url") ||
    srcFromSrcset(node.getAttribute("data-srcset") || node.getAttribute("srcset")) || node.getAttribute("src");
  return collectWebClipImage(images, raw, node.getAttribute("alt") || node.getAttribute("title") || "", baseUrl);
}

function imageTokenFromTag(tag, baseUrl, images) {
  const width = Number(htmlAttr(tag, "width") || 0);
  const height = Number(htmlAttr(tag, "height") || 0);
  if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) return "";
  const raw = htmlAttr(tag, "data-src") || htmlAttr(tag, "data-original") ||
    htmlAttr(tag, "data-lazy-src") || htmlAttr(tag, "data-url") ||
    srcFromSrcset(htmlAttr(tag, "data-srcset") || htmlAttr(tag, "srcset")) || htmlAttr(tag, "src");
  return collectWebClipImage(images, raw, htmlAttr(tag, "alt") || htmlAttr(tag, "title"), baseUrl);
}

function domNodeToMarkdown(node, baseUrl, images) {
  if (!node) return "";
  if (node.nodeType === 3) return escapeWebText(node.nodeValue || "");
  if (node.nodeType !== 1) return "";
  const tag = String(node.tagName || "").toLowerCase();
  if (["script", "style", "noscript", "template", "svg", "canvas", "form", "button", "iframe"].includes(tag)) return "";
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n\n---\n\n";
  if (tag === "pre") {
    return fencedWebCode(node.textContent || "");
  }
  if (tag === "table") return tableToMarkdown(node);
  if (tag === "img") {
    const token = imageTokenFromDom(node, baseUrl, images || []);
    return token ? "\n\n" + token + "\n\n" : "";
  }
  let inner = "";
  for (const child of node.childNodes || []) inner += domNodeToMarkdown(child, baseUrl, images);
  if (!inner.trim()) return "";
  if (/^h[1-6]$/.test(tag)) return "\n\n" + "#".repeat(Number(tag[1])) + " " + cleanMarkdown(inner) + "\n\n";
  if (tag === "p" || tag === "div" || tag === "section" || tag === "article" || tag === "main" || tag === "figure" || tag === "figcaption") {
    return "\n\n" + inner.trim() + "\n\n";
  }
  if (tag === "blockquote") {
    return "\n\n" + cleanMarkdown(inner).split("\n").map((l) => "> " + l).join("\n") + "\n\n";
  }
  if (tag === "strong" || tag === "b") return "**" + inner.trim() + "**";
  if (tag === "em" || tag === "i") return "*" + inner.trim() + "*";
  if (tag === "del" || tag === "s") return "~~" + inner.trim() + "~~";
  if (tag === "code") return String.fromCharCode(96) + inner.trim().split(String.fromCharCode(96)).join("\\" + String.fromCharCode(96)) + String.fromCharCode(96);
  if (tag === "a") {
    const href = absoluteHttpUrl(node.getAttribute("href") || "", baseUrl);
    const label = cleanMarkdown(inner).replace(/[\[\]]/g, "");
    return href && label ? "[" + label + "](<" + href + ">)" : inner;
  }
  if (tag === "li") return "\n- " + cleanMarkdown(inner).replace(/\n/g, "\n  ");
  if (tag === "ol") {
    let i = 0;
    const items = [...node.children].filter((c) => String(c.tagName).toLowerCase() === "li").map((li) => {
      i += 1;
      let body = ""; for (const c of li.childNodes) body += domNodeToMarkdown(c, baseUrl, images);
      return i + ". " + cleanMarkdown(body).replace(/\n/g, "\n   ");
    });
    return "\n\n" + items.join("\n") + "\n\n";
  }
  if (tag === "ul") return "\n\n" + cleanMarkdown(inner) + "\n\n";
  return inner;
}

const WEB_CLIP_REMOVE_SELECTOR = [
  "script", "style", "noscript", "template", "svg", "canvas", "form", "button", "iframe",
  "nav", "footer", "aside", "[aria-hidden='true']", ".advertisement", ".ads", ".ad", ".share",
  ".social-share", ".related-posts", ".recommend-list", "#js_pc_qr_code", ".rich_media_tool",
  "#js_article_bottom_bar", ".weui-dialog", ".rich_media_area_extra", ".rich_media_meta_list",
  ".wx_follow_nickname", "#js_tags", "#js_minipro_dialog"
].join(",");

function textLen(node) {
  if (!node) return 0;
  const clone = node.cloneNode ? node.cloneNode(true) : null;
  if (clone && typeof clone.querySelectorAll === "function") {
    for (const el of clone.querySelectorAll("script,style,noscript,template")) el.remove();
    return cleanMarkdown(clone.textContent || "").length;
  }
  return cleanMarkdown(node.textContent || "").length;
}

function chooseArticleRoot(doc) {
  const selectors = [
    "#js_content", "article", "main", "[role='main']", "[itemprop='articleBody']",
    ".rich_media_content", ".article-content", ".article__content", ".post-content", ".entry-content",
    ".content-article", ".article-body", ".post-body", ".markdown-body",
  ];
  const candidates = [], seen = new Set();
  for (const sel of selectors) {
    for (const el of doc.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      candidates.push(el);
      // 明确正文容器一旦有足够正文就直接采用；公众号 #js_content 优先级最高。
      if (textLen(el) >= WEB_CLIP_MIN_TEXT_CHARS) return el;
    }
  }
  if (doc.body) candidates.push(doc.body);
  let best = doc.body || doc.documentElement;
  let bestScore = -Infinity;
  for (const el of candidates) {
    const len = textLen(el);
    if (!len) continue;
    let linkLen = 0;
    for (const a of el.querySelectorAll("a")) linkLen += textLen(a);
    const score = len - linkLen * 1.7 - (el === doc.body ? 150 : 0);
    if (score > bestScore) { best = el; bestScore = score; }
  }
  return best;
}

function fallbackHtmlToMarkdown(html, baseUrl, images) {
  let body = String(html || "");
  const regions = [];
  for (const tag of ["article", "main"]) {
    const re = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "ig");
    for (const m of body.matchAll(re)) regions.push(m[1]);
  }
  if (regions.length) body = regions.sort((a, b) => b.length - a.length)[0];
  const codeBlocks = [];
  body = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template|svg|canvas|form|nav|footer|aside|iframe)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
      const token = "WEBCLIPPRETOKEN" + codeBlocks.length + "ENDTOKEN";
      codeBlocks.push(fencedWebCode(decodeHtmlEntities(String(code).replace(/<[^>]+>/g, ""))));
      return token;
    });
  // 只转义标签外的网页文本；插件随后生成的链接、标题、列表和图片占位不受影响。
  body = body.split(/(<[^>]+>)/g).map((part) => part.startsWith("<")
    ? part
    : escapeWebText(decodeHtmlEntities(part))).join("");
  body = body
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const token = imageTokenFromTag(tag, baseUrl, images || []);
      return token ? "\n\n" + token + "\n\n" : "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, x) => "\n\n" + "#".repeat(Number(n)) + " " + x + "\n\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<(p|div|section|blockquote|ul|ol|table|tr|figure|figcaption)\b[^>]*>/gi, "\n\n")
    .replace(/<\/(p|div|section|blockquote|ul|ol|table|tr|figure|figcaption)>/gi, "\n\n")
    .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, label) => {
      const href = absoluteHttpUrl(htmlAttr(attrs, "href"), baseUrl);
      const clean = label.replace(/<[^>]+>/g, "").trim();
      // 这里之后还要剥 HTML 标签, 不能使用 <url> 目的地(会被当标签删掉)。
      return href && clean ? "[" + clean + "](" + href + ")" : clean;
    })
    .replace(/<[^>]+>/g, "");
  let markdown = cleanMarkdown(body);
  markdown = markdown.replace(/WEBCLIPPRETOKEN(\d+)ENDTOKEN/g, (_, i) => codeBlocks[Number(i)] || "");
  return hardenWebMarkdown(cleanMarkdown(markdown));
}

function wechatPageVar(html, name) {
  // 只接受真实的 var NAME = 声明，避免咬到 "__biz=" + biz + "&mid=" 之类的拼接诱饵。
  // 公众号长链常见 var biz = "" || "Mz..."，因此允许一个空字面量加 || 的前缀。
  const re = new RegExp("(?:^|[;{}>\\s])var\\s+" + escapeRegExp(name) +
    "\\s*=\\s*(?:[\\\"']\\s*[\\\"']\\s*\\|\\|\\s*)?[\\\"']([^\\\"']+)[\\\"']", "im");
  const m = re.exec(String(html || ""));
  const value = m ? decodeHtmlEntities(m[1]).trim() : "";
  if (!value) return "";
  if (name === "biz" && !/^[A-Za-z0-9+/_-]{4,128}={0,2}$/.test(value)) return "";
  if (name === "mid" && !/^\d{5,30}$/.test(value)) return "";
  if (name === "idx" && !/^\d{1,3}$/.test(value)) return "";
  return value;
}

function wechatPublishedFromHtml(html) {
  const raw = wechatPageVar(html, "createTime");
  if (!raw) return "";
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw) * (raw.length === 10 ? 1000 : 1);
    const d = new Date(n);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return raw.replace(/\s+/g, " ").slice(0, 80);
}

function stripWechatTrackingParams(raw) {
  const normalized = normalizeWebUrl(raw);
  if (!normalized || !isWechatArticleUrl(normalized)) return normalized || raw;
  const u = new URL(normalized);
  if (/^\/s\/[^/]+/.test(u.pathname)) {
    u.search = "";
    return u.toString();
  }
  for (const key of ["chksm", "scene", "nwr_flag", "subscene", "clicktime", "enterid", "ascene", "devicetype", "version", "lang", "nettype", "exportkey", "pass_ticket", "wx_header", "from"]) {
    u.searchParams.delete(key);
  }
  return u.toString();
}

function wechatArticleIdentityUrl(html, sourceUrl, canonicalUrl) {
  if (!isWechatArticleUrl(sourceUrl) && !isWechatArticleUrl(canonicalUrl)) return normalizeWebUrl(canonicalUrl || sourceUrl) || String(canonicalUrl || sourceUrl || "");
  const parsed = [];
  for (const raw of [sourceUrl, canonicalUrl]) {
    try { parsed.push(new URL(normalizeWebUrl(raw) || "")); }
    catch (e) { /* 单个候选无效时继续 */ }
  }
  const validBiz = (v) => /^[A-Za-z0-9+/_-]{4,128}={0,2}$/.test(String(v || "")) ? String(v) : "";
  const validMid = (v) => /^\d{5,30}$/.test(String(v || "")) ? String(v) : "";
  const validIdx = (v) => /^\d{1,3}$/.test(String(v || "")) ? String(v) : "";
  const firstParam = (names, validate) => {
    for (const u of parsed) {
      for (const name of names) {
        const value = validate(u.searchParams.get(name));
        if (value) return value;
      }
    }
    return "";
  };
  // 明确 URL 参数优先于页面变量；页面脚本里可能含字符串拼接诱饵。
  const biz = firstParam(["__biz", "biz"], validBiz) || wechatPageVar(html, "biz");
  const mid = firstParam(["mid"], validMid) || wechatPageVar(html, "mid");
  const idx = firstParam(["idx"], validIdx) || wechatPageVar(html, "idx");
  if (biz && mid && idx) {
    const u = new URL("https://mp.weixin.qq.com/s");
    u.searchParams.set("__biz", biz);
    u.searchParams.set("mid", mid);
    u.searchParams.set("idx", idx);
    return u.toString();
  }
  // 只有拿不到规范的 biz/mid/idx 时，才退回 /s/<id> 身份。
  for (const u of parsed) {
    const short = /^\/s\/([^/?#]+)/.exec(u.pathname);
    if (short) return "https://mp.weixin.qq.com/s/" + short[1];
  }
  return stripWechatTrackingParams(canonicalUrl || sourceUrl);
}

function extractArticleFromHtml(html, sourceUrl, maxChars) {
  html = String(html || "");
  const images = [];
  let title = "", author = "", published = "", site = "", description = "", canonical = sourceUrl, markdown = "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = (...sels) => {
      for (const sel of sels) { const el = doc.querySelector(sel); if (el && el.getAttribute("content")) return el.getAttribute("content").trim(); }
      return "";
    };
    title = meta('meta[property="og:title"]', 'meta[name="twitter:title"]') || cleanMarkdown((doc.querySelector("h1") || {}).textContent || "") || cleanMarkdown(doc.title || "");
    author = meta('meta[name="author"]', 'meta[property="article:author"]', 'meta[name="byl"]');
    published = meta('meta[property="article:published_time"]', 'meta[name="publishdate"]', 'meta[itemprop="datePublished"]', 'meta[name="date"]') || wechatPublishedFromHtml(html);
    site = meta('meta[property="og:site_name"]', 'meta[name="application-name"]');
    description = meta('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]');
    const canonicalEl = doc.querySelector('link[rel="canonical"]') || doc.querySelector('meta[property="og:url"]');
    const canonicalRaw = canonicalEl && (canonicalEl.getAttribute("href") || canonicalEl.getAttribute("content"));
    canonical = absoluteHttpUrl(canonicalRaw || "", sourceUrl) || sourceUrl;
    const root = chooseArticleRoot(doc);
    const clone = root && root.cloneNode(true);
    if (clone) {
      for (const el of clone.querySelectorAll(WEB_CLIP_REMOVE_SELECTOR)) el.remove();
      markdown = cleanMarkdown(domNodeToMarkdown(clone, canonical || sourceUrl, images));
    }
  } else {
    title = metaFromHtml(html, ["og:title", "twitter:title"]);
    if (!title) {
      const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
      const tm = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      title = decodeHtmlEntities(((h1 && h1[1]) || (tm && tm[1]) || "").replace(/<[^>]+>/g, "")).trim();
    }
    author = metaFromHtml(html, ["author", "article:author", "byl"]);
    published = metaFromHtml(html, ["article:published_time", "publishdate", "datepublished", "date"]) || wechatPublishedFromHtml(html);
    site = metaFromHtml(html, ["og:site_name", "application-name"]);
    description = metaFromHtml(html, ["og:description", "description", "twitter:description"]);
    const can = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html) || /<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i.exec(html);
    canonical = absoluteHttpUrl(can ? htmlAttr(can[0], "href") : "", sourceUrl) || sourceUrl;
    markdown = fallbackHtmlToMarkdown(html, canonical || sourceUrl, images);
  }
  title = cleanMarkdown(title).replace(/\s+/g, " ").slice(0, 240);
  if (!title) {
    try { title = new URL(sourceUrl).hostname; } catch (e) { title = "网页剪藏"; }
  }
  // 正文里常把文章标题再放一个 H1, 文件自己的 H1 已经会写一次, 去重但不碰不同的小标题。
  const first = markdown.split("\n")[0] || "";
  if (/^#\s+/.test(first) && cleanMarkdown(first.replace(/^#+\s*/, "")) === title) markdown = markdown.split("\n").slice(1).join("\n").trim();
  const limit = Number.isFinite(Number(maxChars)) ? Math.max(1000, Number(maxChars)) : 200000;
  const truncated = markdown.length > limit;
  if (truncated) markdown = markdown.slice(0, limit).replace(/\s+\S*$/, "").trim();
  markdown = hardenWebMarkdown(markdown);
  canonical = stripWechatTrackingParams(canonical || sourceUrl);
  const identityUrl = wechatArticleIdentityUrl(html, sourceUrl, canonical || sourceUrl);
  return { title, author: cleanMarkdown(author), published: cleanMarkdown(published), site: cleanMarkdown(site),
    description: cleanMarkdown(description), url: sourceUrl, canonicalUrl: canonical || sourceUrl, identityUrl, markdown, truncated, images };
}

function safeClipFilename(title) {
  let s = cleanMarkdown(title || "网页剪藏").replace(/[\u0000-\u001f:*?"<>|#^/\\[\]]/g, "").replace(/\.+$/g, "").trim();
  if (!s) s = "网页剪藏";
  if ([...s].length > 60) s = [...s].slice(0, 60).join("");
  while (Buffer.byteLength(s, "utf8") > 180 && [...s].length > 1) s = [...s].slice(0, -1).join("");
  return s;
}

function webClipIdentityUrl(article) {
  return normalizeWebUrl(article && (article.identityUrl || article.canonicalUrl || article.url)) ||
    String(article && (article.identityUrl || article.canonicalUrl || article.url) || "");
}

function yamlString(value) { return JSON.stringify(String(value || "")); }

function formatWebClipMarkdown(article, note, clippedAt) {
  const title = article.title || "网页剪藏";
  const displayTitle = escapeWebText(title).replace(/\n+/g, " ").trim() || "网页剪藏";
  const sourceUrl = article.url || article.canonicalUrl || "";
  const imageCount = Math.max(0, Number(article.imageCount) || 0);
  const imageFailed = Math.max(0, Number(article.imageFailed) || 0);
  const imageTotal = Math.max(imageCount + imageFailed, Number(article.imageTotal) || 0);
  const lines = [
    "---",
    "title: " + yamlString(title),
    "source_url: " + yamlString(sourceUrl),
    "canonical_url: " + yamlString(article.canonicalUrl || sourceUrl),
    "identity_url: " + yamlString(article.identityUrl || article.canonicalUrl || sourceUrl),
    "source_site: " + yamlString(article.site || ""),
    "author: " + yamlString(article.author || ""),
    "published: " + yamlString(article.published || ""),
    "clipped_at: " + yamlString(clippedAt || new Date().toISOString()),
    "source: wechat-diary-web-clip",
    "web_clip_image_total: " + imageTotal,
    "web_clip_image_count: " + imageCount,
    "web_clip_image_failed: " + imageFailed,
    "tags:",
    "  - 微信剪藏",
    "---",
    "",
    "# " + displayTitle,
    "",
    "> [查看原文](<" + sourceUrl + ">)",
  ];
  if (article.author) lines.push("> 作者：" + escapeWebText(article.author).replace(/\n+/g, " "));
  if (article.published) lines.push("> 发布：" + escapeWebText(article.published).replace(/\n+/g, " "));
  if (article.site) lines.push("> 来源：" + escapeWebText(article.site).replace(/\n+/g, " "));
  if (note) lines.push("", "## 微信附言", "", String(note).replace(/\r\n?/g, "\n").trim());
  lines.push("", "## 正文", "", article.markdown || "_正文为空_", "");
  if (imageFailed) {
    lines.push("## 图片保存报告", "", "> [!warning] 有 " + imageFailed + " 张图片未能保存；正文中保留了可点击的原图地址。", "");
    const failures = Array.isArray(article.imageFailures) ? article.imageFailures : [];
    for (const failure of failures.slice(0, 20)) {
      const reason = String((failure && failure.error) || "图片下载失败").replace(/[\r\n]+/g, " ").trim();
      const failureUrl = normalizeWebUrl(failure && failure.url);
      lines.push("- " + reason + (failureUrl ? " — [查看原图](<" + failureUrl + ">)" : ""));
    }
    if (failures.length > 20) lines.push("- 另有 " + (failures.length - 20) + " 项未展开");
    lines.push("");
  }
  if (article.truncated) lines.push("> [!warning] 正文过长，已按插件上限截断；原文链接保留在上方。", "");
  return lines.join("\n");
}

function responseHeader(headers, name) {
  for (const k of Object.keys(headers || {})) if (k.toLowerCase() === name.toLowerCase()) return String(headers[k] || "");
  return "";
}

function requestWebClipBinaryHop(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req = null;
    let timer = null;
    const chunks = [];
    let total = 0;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      fn(value);
    };
    try {
      const parsed = new URL(url);
      const transport = parsed.protocol === "https:" ? getHttps() : require("http");
      req = transport.request(parsed, { method: "GET", headers }, (res) => {
        const status = Number(res.statusCode || 0);
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          done(resolve, { redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        if (!(status >= 200 && status < 300)) {
          res.resume();
          done(reject, new Error("HTTP " + (status || "错误")));
          return;
        }
        const announced = Number(res.headers["content-length"] || 0);
        if (announced > WEB_CLIP_MAX_IMAGE_BYTES) {
          res.resume();
          done(reject, new Error("单张图片超过 15MB 上限"));
          return;
        }
        res.on("data", (chunk) => {
          if (settled) return;
          total += chunk.length;
          if (total > WEB_CLIP_MAX_IMAGE_BYTES) {
            done(reject, new Error("单张图片超过 15MB 上限"));
            try { req.destroy(); } catch (e) { /* noop */ }
            return;
          }
          chunks.push(chunk);
        });
        res.on("aborted", () => done(reject, new Error("图片下载中断")));
        res.on("end", () => done(resolve, { status, headers: res.headers, buffer: Buffer.concat(chunks) }));
      });
      timer = window.setTimeout(() => {
        done(reject, new Error("图片响应超时"));
        try { req.destroy(); } catch (e) { /* noop */ }
      }, Math.max(1, Number(timeoutMs) || WEB_CLIP_IMAGE_TIMEOUT_MS));
      req.on("error", (e) => done(reject, e));
      req.end();
    } catch (e) {
      done(reject, e);
    }
  });
}

async function requestWebClipBinaryDirect(rawUrl, headers, timeoutMs) {
  let url = normalizeWebUrl(rawUrl);
  if (!url || isUnsafeWebUrl(url)) throw new Error("图片地址不是公开 http/https URL");
  const deadline = Date.now() + Math.max(1, Number(timeoutMs) || WEB_CLIP_IMAGE_TIMEOUT_MS);
  for (let hop = 0; hop <= MEDIA_MAX_REDIRECTS; hop++) {
    let result = null;
    let lastError = null;
    // 某些图片 CDN（实测 pbs.twimg.com）偶发在 TLS 建连前 ECONNRESET；短暂重试一次即可恢复。
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error("图片响应超时");
        result = await requestWebClipBinaryHop(url, headers, remaining);
        break;
      } catch (e) {
        lastError = e;
        const message = String((e && e.message) || e);
        const reset = e && e.code === "ECONNRESET" || /ECONNRESET/i.test(message);
        if (attempt > 0 || !reset) throw e;
        const delay = Math.min(200, Math.max(0, deadline - Date.now()));
        if (!delay) throw new Error("图片响应超时");
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
    }
    if (!result) throw lastError || new Error("图片直连失败");
    if (!result.redirect) return result;
    if (hop >= MEDIA_MAX_REDIRECTS) throw new Error("图片重定向过多");
    url = normalizeWebUrl(result.redirect);
    if (!url || isUnsafeWebUrl(url)) throw new Error("图片重定向到了非公开地址");
  }
  throw new Error("图片重定向过多");
}

class WebClipError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function isBlockedByClientError(error) {
  return /ERR_BLOCKED_BY_CLIENT/i.test(String((error && error.message) || error || ""));
}

class WebClipper {
  constructor(plugin, deps) {
    this.plugin = plugin;
    this._directImageRequest = deps && deps.directImageRequest ? deps.directImageRequest : requestWebClipBinaryDirect;
  }

  async _fetchImage(image, referer, timeoutMs) {
    const url = normalizeWebUrl(image && image.url);
    if (!url || isUnsafeWebUrl(url)) throw new WebClipError("unsafe_image", "图片地址不是公开 http/https URL");
    const budget = Math.max(1, Math.min(WEB_CLIP_IMAGE_TIMEOUT_MS, Number(timeoutMs) || WEB_CLIP_IMAGE_TIMEOUT_MS));
    const deadline = Date.now() + budget;
    const imageHeaders = {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5",
      Referer: referer,
      "User-Agent": WEB_CLIP_BROWSER_UA,
    };
    let response;
    let requestError = null;
    // 优先走 Obsidian 请求层，遵循系统代理。只有 Electron 明确以
    // ERR_BLOCKED_BY_CLIENT 拒绝跨域图片时，才退回桌面端 Node 直连。
    try {
      let timeoutId;
      try {
        response = await Promise.race([
          requestUrl({
            url, method: "GET", throw: false,
            headers: { Accept: imageHeaders.Accept, "User-Agent": imageHeaders["User-Agent"] },
          }),
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error("图片响应超时")), budget);
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    } catch (e) {
      requestError = e;
    }
    if (!response) {
      if (!isBlockedByClientError(requestError)) {
        throw new WebClipError("image_network", "图片无法访问: " + String((requestError && requestError.message) || requestError || "未知错误"));
      }
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error("图片响应超时");
        response = await this._directImageRequest(url, imageHeaders, remaining);
      } catch (e) {
        throw new WebClipError("image_network", "图片无法访问: " + String((e && e.message) || e));
      }
    }
    const status = Number(response && response.status);
    if (!(status >= 200 && status < 300)) throw new WebClipError("image_http", "图片返回 HTTP " + (status || "错误"));
    const announced = Number(responseHeader(response.headers, "content-length"));
    if (Number.isFinite(announced) && announced > WEB_CLIP_MAX_IMAGE_BYTES) {
      throw new WebClipError("image_too_large", "单张图片超过 15MB 上限");
    }
    let buf = Buffer.alloc(0);
    if (response.buffer) buf = Buffer.isBuffer(response.buffer) ? response.buffer : Buffer.from(response.buffer);
    else if (response.arrayBuffer) buf = Buffer.from(response.arrayBuffer);
    if (!buf.length) throw new WebClipError("image_empty", "图片没有返回内容");
    if (buf.length > WEB_CLIP_MAX_IMAGE_BYTES) throw new WebClipError("image_too_large", "单张图片超过 15MB 上限");
    const ext = sniffImageExt(buf);
    if (!ext) throw new WebClipError("image_format", "图片格式无法识别");
    return { ...image, url, buffer: buf, ext };
  }

  async fetchArticle(rawUrl) {
    const deadline = Date.now() + WEB_CLIP_TOTAL_BUDGET_MS;
    const url = normalizeWebUrl(rawUrl);
    if (!url || isUnsafeWebUrl(url)) throw new WebClipError("unsafe", "只支持公开的 http/https 网页");
    let res;
    try {
      const call = requestUrl({
        url, method: "GET", throw: false,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
          "User-Agent": WEB_CLIP_BROWSER_UA,
        },
      });
      let timeoutId;
      try {
        res = await Promise.race([
          call,
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new WebClipError("timeout", "网页响应超时")), WEB_CLIP_FETCH_TIMEOUT_MS);
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    } catch (e) {
      if (e instanceof WebClipError) throw e;
      throw new WebClipError("network", "网页无法访问: " + String((e && e.message) || e));
    }
    const status = Number(res && res.status);
    if (!(status >= 200 && status < 300)) throw new WebClipError("http", "网页返回 HTTP " + (status || "错误"));
    const type = responseHeader(res.headers, "content-type").toLowerCase();
    if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      throw new WebClipError("content_type", "这不是 HTML 网页 (" + type.split(";")[0] + ")");
    }
    let html = typeof res.text === "string" ? res.text : "";
    if (!html && res.arrayBuffer) html = Buffer.from(res.arrayBuffer).toString("utf8");
    if (!html) throw new WebClipError("empty", "网页没有返回内容");
    if (Buffer.byteLength(html, "utf8") > WEB_CLIP_MAX_HTML_BYTES) throw new WebClipError("too_large", "网页源码超过 5MB 上限");
    const article = extractArticleFromHtml(html, url, this.plugin.settings.webClipMaxChars);
    const bodyText = cleanMarkdown(article.markdown
      .replace(/!\[[^\]]*\]\(<[^>]+>\)/g, "")
      .replace(/%%WECHAT_DIARY_IMAGE_\d+%%/g, ""));
    if (!article.markdown || bodyText.length < WEB_CLIP_MIN_TEXT_CHARS) {
      throw new WebClipError("no_text", "没找到足够的正文，网页可能需要登录或 JavaScript 渲染");
    }
    const referencedImages = (article.images || []).filter((image) => article.markdown.includes(image.token));
    if (this.plugin.settings.webClipSaveImages === false) {
      article.images = referencedImages.map((image) => ({ ...image, skipped: true }));
      return article;
    }
    const maxImages = webClipMaxImages(this.plugin.settings);
    const maxTotalImageBytes = webClipMaxTotalImageBytes(this.plugin.settings);
    const maxTotalImageMb = Math.floor(maxTotalImageBytes / 1024 / 1024);
    const downloaded = new Array(referencedImages.length);
    for (let i = maxImages; i < referencedImages.length; i++) {
      downloaded[i] = { ...referencedImages[i], error: "超过每篇 " + maxImages + " 张图片上限" };
    }
    let nextImage = 0;
    const worker = async () => {
      while (true) {
        const i = nextImage++;
        if (i >= Math.min(maxImages, referencedImages.length)) return;
        const image = referencedImages[i];
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          downloaded[i] = { ...image, error: "超过 75 秒总时间预算，未下载" };
          continue;
        }
        try {
          downloaded[i] = await this._fetchImage(image, article.canonicalUrl || url, Math.min(WEB_CLIP_IMAGE_TIMEOUT_MS, remaining));
        } catch (e) {
          const reason = String((e && e.message) || e);
          console.warn("[wechat-diary] 网页正文图片下载失败:", image.url, reason);
          downloaded[i] = { ...image, error: reason };
        }
      }
    };
    const workers = Math.min(WEB_CLIP_IMAGE_CONCURRENCY, maxImages, referencedImages.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    let totalBytes = 0;
    for (let i = 0; i < downloaded.length; i++) {
      const saved = downloaded[i];
      if (!saved || !saved.buffer) continue;
      if (totalBytes + saved.buffer.length > maxTotalImageBytes) {
        downloaded[i] = { ...referencedImages[i], error: "正文图片合计超过 " + maxTotalImageMb + "MB 上限" };
      } else {
        totalBytes += saved.buffer.length;
      }
    }
    article.images = downloaded;
    return article;
  }
}

// ── 日记写入(019 diary_writer.py 移植, 产出字节级一致; 宿主换成 vault API)─

const HEADER_RE_G = /\*\*(\d{1,2}:\d{2})\*\*/g;
const HEADER_FULL_RE = /^\*\*\d{1,2}:\d{2}\*\*$/;
const NORMALIZE_BLANK_RE = /\n\s*\n+/g;

// 日记消息块统一入口：CRLF、空行与契约保留前缀必须和 write() 完全一致，
// 否则一次发送会被拆成多个块，或让撤回误删更早的内容。
function normalizeDiaryBlockText(value, protectPrefix) {
  let text = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(NORMALIZE_BLANK_RE, "\n").trim();
  if (protectPrefix !== false && (text.startsWith("# ") || text.startsWith("---") || text.startsWith("_("))) text = "\\" + text;
  return text;
}
const CLOSING_MARKER = "_(今日封存于";

function lastHeaderTime(content) {
  let last = null;
  for (const m of content.matchAll(HEADER_RE_G)) last = m[1];
  return last;
}

// 同分钟合并的前提: 最后一个段头是同一分钟, **且它在最后一个封存标记之后**。
// 单模式下「结束」后同一分钟继续发, 不能把新内容塞到封存线下面去当无头段落——
// 要另起段头 (2026-08-16 019 e2e 冒烟抓出, 两侧同步修)。
function canMergeIntoLastHeader(content, timestamp) {
  let last = null;
  for (const m of content.matchAll(HEADER_RE_G)) last = m;
  if (!last || last[1] !== timestamp) return false;
  return content.lastIndexOf(CLOSING_MARKER) < last.index;
}

function isMessageBlock(stripped) {
  if (!stripped) return false;
  if (stripped.startsWith("# ")) return false;
  if (HEADER_FULL_RE.test(stripped)) return false;
  if (stripped.startsWith("---")) return false;
  if (stripped.startsWith("_(")) return false;
  return true;
}

function countMessages(content) {
  return content.split("\n\n").filter((b) => isMessageBlock(b.trim())).length;
}

// ── #15/D13 路径层与共用文件模式的纯函数(表驱动可测, bindtest 走 __internals) ─────────────
// ===== #15 路径层 + 共用每日笔记节: 纯函数(逐段粘进 main.js) =====
// 约定: 顶层 function 声明 + 少量 const 常量; 不 import/require; 末尾一行 module.exports 只给测试用。

// ---------- 路径格式校验 ----------

// moment 日期类令牌白名单: 字母 → 允许的连续段长(按 moment 贪心分词: 同一字母连续为一段)
const PATH_TOKEN_LENGTHS = {
  Y: [2, 4],        // YY YYYY
  M: [1, 2, 3, 4],  // M MM MMM MMMM
  D: [1, 2, 3, 4],  // D DD DDD DDDD
  d: [1, 2, 3, 4],  // d dd ddd dddd
  E: [1],
  e: [1],
  w: [1, 2],        // w ww
  Q: [1],
};
const PATH_LITERAL_RE = /\[[^\[]*\]/g;        // moment 的 [..] 字面量(与 moment 源码同一条正则)
const PATH_ILLEGAL_CHARS_RE = /[\\:*?"<>|]/;
const PATH_TOKEN_ERROR = "英文字母会被当成日期代码, 文件夹名请放在方括号里, 如 [Assets]";
const PATH_NOT_DAILY_ERROR = "这个格式两天会写进同一个文件";

function renderPath(format, dateStr, momentLib) {
  const m = momentLib(dateStr, "YYYY-MM-DD");
  // 纯数字令牌固定 en 地区: moment 在 ar/fa/hi 等界面语言下会把数字换成本地数字, 独立模式的默认路径必须与 0.3.1 逐字节相同;
  // 只有带月份/星期名(MMM/dddd)的格式才跟界面语言走(与每日笔记核心插件一致)
  const bare = String(format).replace(PATH_LITERAL_RE, "");
  if (/MMM|ddd/.test(bare) || typeof m.locale !== "function") return m.format(format);
  return m.locale("en").format(format);
}

// 剥掉 [..] 字面量后, 剩余英文字母必须全部是白名单令牌
function pathFormatTokensOk(format) {
  const bare = format.replace(PATH_LITERAL_RE, "");
  const runs = bare.match(/[A-Za-z]+/g) || [];
  for (const run of runs) {
    let i = 0;
    while (i < run.length) {
      const ch = run[i];
      let j = i;
      while (j < run.length && run[j] === ch) j++;
      const allowed = PATH_TOKEN_LENGTHS[ch];
      if (!allowed || allowed.indexOf(j - i) === -1) return false;
      i = j;
    }
  }
  return true;
}

// 渲染出来的一条路径的形状检查; 返回错误文案或 null
function renderedPathError(rendered) {
  if (PATH_ILLEGAL_CHARS_RE.test(rendered)) return '路径里不能有 \\ : * ? " < > | 这些字符';
  const segs = rendered.split("/");
  if (segs.some((s) => s === "")) return "路径里不能有空的文件夹名";
  if (segs.some((s) => s === "..")) return "路径里不能有 ..";
  return null;
}

// 2024-01-01 … 2024-12-31(闰年 366 天)+ 2025-01-01
function dailyProbeDates() {
  const out = [];
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < 367; i++) {
    out.push(new Date(start + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// opts = { requireDaily: boolean, momentLib }
// 返回 { ok, value, error }; value 为清洗后的格式串(不合法时也给, 供预览)
function validatePathFormat(format, opts) {
  const momentLib = opts && opts.momentLib;
  const requireDaily = !!(opts && opts.requireDaily);
  const fail = (value, error) => ({ ok: false, value, error });

  let v = typeof format === "string" ? format : "";
  const strip = (s) => s.replace(/^[\s/]+|[\s/]+$/g, "");
  v = strip(v);
  v = v.replace(/\.md$/i, "");
  v = strip(v);

  if (!v) return fail(v, "路径格式不能为空");
  if (v.split("/").some((s) => s === "..")) return fail(v, "路径里不能有 ..");
  if (!pathFormatTokensOk(v)) return fail(v, PATH_TOKEN_ERROR);

  const probes = requireDaily ? dailyProbeDates() : ["2024-01-01"];
  const seen = new Set();
  for (const day of probes) {
    let rendered;
    try {
      rendered = renderPath(v, day, momentLib);
    } catch (e) {
      return fail(v, "这个格式没法渲染: " + (e && e.message ? e.message : String(e)));
    }
    const err = renderedPathError(rendered);
    if (err) return fail(v, err);
    if (requireDaily) {
      if (seen.has(rendered)) return fail(v, PATH_NOT_DAILY_ERROR);
      seen.add(rendered);
    }
  }
  return { ok: true, value: v, error: null };
}

// ---------- 节标题 ----------

// 返回 { value, stripped, error }; stripped = 剥掉了前导 #
function normalizeHeading(raw) {
  let v = typeof raw === "string" ? raw.trim() : "";
  let stripped = false;
  if (v.charAt(0) === "#") {
    v = v.replace(/^#+\s*/, "").trim();
    stripped = true;
  }
  let error = null;
  if (!v) error = "节标题不能为空";
  else if (/[\r\n]/.test(v)) error = "节标题不能换行";
  else if (Array.from(v).length > 30) error = "节标题最多 30 个字";
  return { value: v, stripped, error };
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- 节的定位与写回(§4.1) ----------

const FENCE_LINE_RE = /^ {0,3}(```|~~~)/;
const FM_DELIM_LINE_RE = /^---[ \t]*\r?$/;
const ANY_HEADING_LINE_RE = /^#{1,6} /;

// 文件以 --- 行开头且后面有闭合 --- 行 → 返回闭合行之后的偏移; 否则 0(从头扫)
function frontmatterEnd(content) {
  const len = content.length;
  let e = content.indexOf("\n");
  if (e === -1) e = len;
  if (!FM_DELIM_LINE_RE.test(content.slice(0, e))) return 0;
  let pos = e + 1;
  while (pos < len) {
    let le = content.indexOf("\n", pos);
    if (le === -1) le = len;
    if (FM_DELIM_LINE_RE.test(content.slice(pos, le))) return le < len ? le + 1 : len;
    pos = le + 1;
  }
  return 0;
}

// 返回 { headingStart, bodyStart, bodyEnd } 或 null
function locateSection(content, heading) {
  if (typeof content !== "string") return null;
  const len = content.length;
  const target = "## " + heading;
  let inFence = false;
  let headingStart = -1;
  let bodyStart = -1;
  let pos = frontmatterEnd(content);
  while (pos < len) {
    let e = content.indexOf("\n", pos);
    if (e === -1) e = len;
    const line = content.slice(pos, e);
    const next = e < len ? e + 1 : len;
    if (FENCE_LINE_RE.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      if (headingStart === -1) {
        if (line.replace(/[ \t\r]+$/, "") === target) {
          headingStart = pos;
          bodyStart = next;
        }
      } else if (ANY_HEADING_LINE_RE.test(line)) {
        return { headingStart, bodyStart, bodyEnd: pos };
      }
    }
    pos = next;
  }
  if (headingStart === -1) return null;
  return { headingStart, bodyStart, bodyEnd: len };
}

// 写回 = 前段 + 收口 + 标题行 + 正文(rstrip 后补单个 \n; 空则不补) + (后段非空则空行) + 后段
// 承诺: bodyEnd 之后的内容逐字节不动; 标题前允许多一个空行
function spliceSection(content, loc, newBody, heading) {
  const before = content.slice(0, loc.headingStart);
  const after = content.slice(loc.bodyEnd);
  let out = before;
  if (out.length > 0) {
    if (!out.endsWith("\n")) out += "\n";
    if (!/\n\r?\n$/.test(out)) out += "\n";
  }
  out += "## " + heading + "\n";
  const body = typeof newBody === "string" ? newBody.replace(/\s+$/, "") : "";
  if (body) out += body + "\n";
  if (after.length > 0) out += "\n";
  out += after;
  return out;
}

// 文件存在但没有节: 追加到末尾(收口规则同 spliceSection)
function appendSection(content, heading, body) {
  const c = typeof content === "string" ? content : "";
  const loc = { headingStart: c.length, bodyStart: c.length, bodyEnd: c.length };
  return spliceSection(c, loc, body, heading);
}

function normalizeNewlines(s) {
  return String(s).replace(/\r\n?/g, "\n");
}

// 去尾部空行, 留单个 \n; 全空 → ""
function trimBody(body) {
  const t = typeof body === "string" ? body.replace(/\s+$/, "") : "";
  return t ? t + "\n" : "";
}

// 块内任何一行以 #×1–6 + 空格开头 → 行首加 \; #hashtag 不动
function escapeHeadingLines(block) {
  return String(block).replace(/^(#{1,6} )/gm, "\\$1");
}
// 代码围栏行也要转义: 一条含奇数个 ``` 的消息会让节的扫描进入"围栏内", 后面用户的标题不再算节的终点, 节吞掉用户内容。
// 行首 \``` 在 CommonMark 里是字面反引号, 不再是围栏。与 # 同款全转义(不区分成对与否, 规则一句话讲清)。
function escapeFenceLines(block) {
  return String(block).replace(/^( {0,3})(```|~~~)/gm, "$1\\$2");
}

// ---------- 模板 ----------

const TEMPLATE_PLACEHOLDER_RE = /\{\{title\}\}|\{\{(date|time)(?::([^}]*))?\}\}/g;

// ctx = { dateStr, now(Date), title, momentLib }
function renderTemplate(tpl, ctx) {
  const c = ctx || {};
  const momentLib = c.momentLib;
  return String(tpl).replace(TEMPLATE_PLACEHOLDER_RE, (m, kind, fmt) => {
    if (!kind) return c.title == null ? "" : String(c.title);
    if (kind === "date") return momentLib(c.dateStr, "YYYY-MM-DD").format(fmt || "YYYY-MM-DD");
    return momentLib(c.now || new Date()).format(fmt || "HH:mm");
  });
}

// ---------- 外来文件判定(B1) ----------

// 非空且 frontmatter 里没有 source: wechat-diary → true
function isForeignFile(content) {
  if (typeof content !== "string" || content.trim() === "") return false;
  const lines = content.split("\n");
  if (!FM_DELIM_LINE_RE.test(lines[0])) return true;
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM_LINE_RE.test(lines[i])) {
      for (let j = 1; j < i; j++) {
        if (/^source:\s*["']?wechat-diary["']?\s*\r?$/.test(lines[j])) return false;
      }
      return true;
    }
  }
  return true;
}

// ---------- 测试用迷你 moment(只给 tests 的 obsidian 桩用) ----------

// 撤回最后一条消息块(纯函数, 独立模式对全文、共用模式对节正文同一套规则)。返回 { ok, removed, content }。
function removeLastBlock(content) {
  const parts = content.split("\n\n");
  let lastMsgI = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isMessageBlock(parts[i].trim())) { lastMsgI = i; break; }
  }
  if (lastMsgI < 0) return { ok: false, removed: null, content };
  const removed = parts[lastMsgI].trim();
  const newParts = parts.slice(0, lastMsgI);
  while (newParts.length) {
    const tail = newParts[newParts.length - 1].trim();
    if (!tail || HEADER_FULL_RE.test(tail)) newParts.pop();
    else break;
  }
  // 被删块之后的封存行要保住: 用户「晚安」封存后再「撤回」, 不能连句号一起撤掉(2026-08-19 修)。
  // 例外: 撤光了(一条内容都不剩)就连封存行一起清, 空页不该留个"今日封存"。
  if (newParts.some((b) => isMessageBlock(b.trim()))) {
    for (const b of parts.slice(lastMsgI + 1)) {
      const t = b.trim();
      if (t.startsWith("---") || t.startsWith("_(")) newParts.push(t);
    }
  }
  let out = newParts.join("\n\n");
  if (out && !out.endsWith("\n")) out += "\n";
  return { ok: true, removed, content: out };
}

// 封存(纯函数)。返回 { status, n, afterSeal, content }: sealed(这次真写了标记) | already(本来就有, 幂等) | empty(没内容)。
function sealContent(content, hhmm) {
  if (!content.trim()) return { status: "empty", n: 0, afterSeal: 0, content };
  const n = countMessages(content);
  if (!n) return { status: "empty", n: 0, afterSeal: 0, content }; // 只剩 frontmatter/标题(全撤回了): 没东西可封
  const idx = content.lastIndexOf(CLOSING_MARKER);
  if (idx >= 0) return { status: "already", n, afterSeal: countMessages(content.slice(idx)), content };
  return { status: "sealed", n, afterSeal: 0, content: content + "\n\n---\n" + CLOSING_MARKER + " " + hhmm + ")_\n" };
}

class DiaryWriter {
  constructor(plugin, ai) { this.plugin = plugin; this.ai = ai; }

  // ── 路径层(#15/D13): 根目录 + 路径格式(moment) + 附件位置三模式。默认值 = 0.3.1 的固定布局。
  _root() {
    const f = this.plugin.settings.diaryFolder || "日记";   // 兜底与 0.3.1 同款, 不多做清洗(设置页存进来的已 trim)
    return f === "/" ? "" : normalizePath(f);   // "/" = 库根目录(核心每日笔记的默认位置)
  }
  _fmt() { return this.plugin.settings.pathFormat || DEFAULT_SETTINGS.pathFormat; }
  _join(root, rel) { return normalizePath(root ? root + "/" + rel : rel); }
  _shared() { return !!this.plugin.settings.sharedDailyNote; }
  _heading() { return String(this.plugin.settings.sectionHeading || DEFAULT_SETTINGS.sectionHeading).trim() || DEFAULT_SETTINGS.sectionHeading; }

  diaryPath(dateStr) {
    return this._join(this._root(), renderPath(this._fmt(), dateStr, moment) + ".md");
  }

  // 附件目录: diary(现状)= 日记/attachments/2026; custom = 用户格式串渲染; obsidian 模式在 resolveAttachmentPath 里换算
  _attachmentDir(dateStr) {
    const st = this.plugin.settings;
    const mode = st.attachmentMode || "diary";
    if (mode === "custom") {
      const folder = String(st.attachmentFolder || "").trim();
      const sub = String(st.attachmentSubFormat || "").trim();
      const base = folder === "/" ? "" : (folder ? normalizePath(folder) : "");
      const rel = sub ? renderPath(sub, dateStr, moment) : "";
      if (base || rel) return this._join(base, rel);   // 都没选 → 落到默认位置
    }
    return this._join(this._root(), "attachments/" + dateStr.slice(0, 4));
  }

  // 「跟随 Obsidian 的附件设置」: 用官方接口按用户设置(库根/指定文件夹/当前文件旁/子文件夹)换算, 它自建目录并去重文件名。
  // 来源文件不存在时接口会退到库根目录, 所以共用模式下先把当天的每日笔记建出来(带模板)再问它。
  async resolveAttachmentPath(dateStr, path) {
    if ((this.plugin.settings.attachmentMode || "diary") !== "obsidian") return path;
    const fm = this.plugin.app.fileManager;
    if (!fm || typeof fm.getAvailablePathForAttachment !== "function") return path;
    const day = dateStr || logicalTodayStr();
    const notePath = this.diaryPath(day);
    try {
      // 来源文件不存在时接口退到库根目录(两种模式都一样), 先把当天文件建出来: 共用模式带模板建壳, 独立模式建空文件
      // (之后 _transform 对空文件补 frontmatter+段头, 与直接 create 的字节相同, bindtest【29】已断言)
      if (!this.plugin.app.vault.getFileByPath(notePath)) {
        if (this._shared()) { await this._createDayFile(day, ""); this._freshShell = { day, ts: Date.now() }; }
        else { await this._ensureParents(notePath); await this.plugin.app.vault.create(notePath, ""); }
      }
      const resolved = await fm.getAvailablePathForAttachment(path.split("/").pop(), notePath);
      return resolved ? normalizePath(resolved) : path;
    } catch (e) {
      console.error("[wechat-diary] 按 Obsidian 附件设置换算路径失败, 用默认位置:", e && e.message);
      return path;
    }
  }

  webClipFolder() {
    return normalizePath(this.plugin.settings.webClipFolder || defaultWebClipFolder(this.plugin.settings));
  }

  webClipPath(article, dateStr) {
    const url = webClipIdentityUrl(article);
    const hash = md5Hex(Buffer.from(url, "utf8")).slice(0, 10);
    const name = dateStr + "-" + safeClipFilename(article.title) + "-" + hash + ".md";
    return normalizePath(this.webClipFolder() + "/" + dateStr.slice(0, 4) + "/" + name);
  }

  webClipAssetFolder(article, dateStr) {
    const url = webClipIdentityUrl(article);
    const hash = md5Hex(Buffer.from(url, "utf8")).slice(0, 10);
    return normalizePath(this.webClipFolder() + "/assets/" + dateStr.slice(0, 4) + "/" + dateStr + "-" + hash);
  }

  async _localizeWebClipImages(article, dateStr) {
    const vault = this.plugin.app.vault;
    const images = Array.isArray(article.images) ? article.images : [];
    let markdown = String(article.markdown || "");
    let imageCount = 0;
    let imageFailed = 0;
    const imageFailures = [];
    const folder = this.webClipAssetFolder(article, dateStr);
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image || !image.token || !markdown.includes(image.token)) continue;
      let replacement = "";
      if (image.buffer && image.ext) {
        try {
          const buf = Buffer.isBuffer(image.buffer) ? image.buffer : Buffer.from(image.buffer);
          const name = String(i + 1).padStart(2, "0") + "-" + md5Hex(buf).slice(0, 10) + "." + image.ext;
          const path = normalizePath(folder + "/" + name);
          await this._ensureParents(path);
          if (!vault.getAbstractFileByPath(path)) {
            await vault.createBinary(path, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
          }
          replacement = "![[" + path + "]]";
          imageCount += 1;
        } catch (e) {
          console.error("[wechat-diary] 保存网页正文图片失败:", e);
          imageFailed += 1;
          imageFailures.push({ url: image.url || "", error: "写入 Vault 失败: " + String((e && e.message) || e) });
        }
      } else if (!image.skipped) {
        imageFailed += 1;
        imageFailures.push({ url: image.url || "", error: image.error || "图片下载失败" });
      }
      if (!replacement) {
        const label = (image.skipped ? "查看原图：" : "图片未保存：") + (image.alt || "图片");
        replacement = image.url ? "[" + label.replace(/[\[\]]/g, "") + "](<" + image.url + ">)" : "_" + label + "_";
      }
      markdown = markdown.split(image.token).join(replacement);
    }
    return { ...article, markdown, imageTotal: images.length, imageCount, imageFailed, imageFailures };
  }

  async _findWebClip(url) {
    const normalized = normalizeWebUrl(url) || String(url || "");
    const vault = this.plugin.app.vault;
    if (!Array.isArray(this.plugin.data.webClips)) this.plugin.data.webClips = [];
    const list = this.plugin.data.webClips;
    for (let i = list.length - 1; i >= 0; i--) {
      const rec = list[i];
      if (!rec || !rec.path || !vault.getAbstractFileByPath(rec.path)) {
        list.splice(i, 1);
        continue;
      }
      if (rec.url === normalized) return rec.path;
    }
    // data.json 被清掉也尽量不重复剪藏: 文件名末尾带 URL hash, 只读极少量候选核对 frontmatter。
    const hash = md5Hex(Buffer.from(normalized, "utf8")).slice(0, 10);
    const folder = this.webClipFolder() + "/";
    const files = typeof vault.getMarkdownFiles === "function"
      ? vault.getMarkdownFiles()
      : (typeof vault.getFiles === "function" ? vault.getFiles() : []);
    for (const f of files) {
      if (!f || !f.path || !f.path.startsWith(folder) || !f.path.endsWith("-" + hash + ".md")) continue;
      try {
        const content = await vault.cachedRead(f);
        if (content.includes("source_url: " + yamlString(normalized)) ||
            content.includes("canonical_url: " + yamlString(normalized)) ||
            content.includes("identity_url: " + yamlString(normalized))) return f.path;
      } catch (e) { /* 单篇读失败不阻断其他候选 */ }
    }
    return "";
  }

  _rememberWebClip(url, path) {
    const normalized = normalizeWebUrl(url) || String(url || "");
    if (!Array.isArray(this.plugin.data.webClips)) this.plugin.data.webClips = [];
    const list = this.plugin.data.webClips;
    for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].url === normalized) list.splice(i, 1);
    list.push({ url: normalized, path });
    if (list.length > 300) list.splice(0, list.length - 300);
  }

  // 只保存（或复用）一篇剪藏，不碰今日日记。多链接消息靠这个阶段先攒齐所有入口。
  async saveWebClip(article, note, dateStr) {
    const day = dateStr || logicalTodayStr();
    const vault = this.plugin.app.vault;
    const identityUrl = webClipIdentityUrl(article);
    let path = await this._findWebClip(identityUrl);
    let reused = Boolean(path);
    // 早期同 URL 文件可能不含图片元数据。重新发送后若抓到更多图片，另存改进版，保留旧文件不覆盖。
    const freshImageCount = (article.images || []).filter((image) => image && image.buffer).length;
    if (path && freshImageCount) {
      try {
        const oldFile = vault.getFileByPath ? vault.getFileByPath(path) : vault.getAbstractFileByPath(path);
        const oldContent = oldFile ? await vault.cachedRead(oldFile) : "";
        const oldCountMatch = /^web_clip_image_count:\s*(\d+)/m.exec(oldContent);
        const oldImageCount = oldCountMatch ? Number(oldCountMatch[1]) : -1;
        if (freshImageCount > oldImageCount) { path = ""; reused = false; }
      } catch (e) { /* 读不到旧文件时继续复用，避免误覆盖 */ }
    }
    let preparedArticle = article;
    if (!path) {
      path = this.webClipPath(article, day);
      try {
        preparedArticle = await this._localizeWebClipImages(article, day);
        await this._ensureParents(path);
        // URL hash 已让冲突极罕见; 真遇到同名用户文件时不覆盖, 加随机尾巴。
        for (let i = 0; i < 5 && vault.getAbstractFileByPath(path); i++) path = path.replace(/\.md$/, "-" + randHex(4) + ".md");
        await vault.create(path, formatWebClipMarkdown(preparedArticle, note));
      } catch (e) {
        console.error("[wechat-diary] 保存网页剪藏失败:", e);
        return { path: "", title: article.title || "网页剪藏", reused: false, identityUrl,
          diskFull: String(e && e.message).includes("ENOSPC") };
      }
    }
    return { path, title: article.title || "网页剪藏", reused, identityUrl, diskFull: false,
      imageCount: preparedArticle.imageCount || 0, imageFailed: preparedArticle.imageFailed || 0 };
  }

  // 把原句和一条或多条剪藏入口一次写成同一个消息块，保持段数和撤回边界稳定。
  async appendWebClipEntries(entries, originalText, dateStr) {
    const day = dateStr || logicalTodayStr();
    const ready = (entries || []).filter((entry) => entry && entry.path);
    if (!ready.length) return { n: 0, sealed: false, diskFull: false };
    try {
      const links = ready.map((entry) => {
        const alias = ("🔖 " + (entry.title || "网页剪藏")).replace(/[|\[\]\r\n]/g, " ").replace(/\s+/g, " ").trim();
        return "[[" + entry.path + "|" + alias + "]]";
      });
      const original = normalizeDiaryBlockText(originalText);
      const block = (original ? [original, ...links] : links).join("\n");
      const finalContent = await this._appendBlock(day, hhmmStr(), block);
      for (const entry of ready) this._rememberWebClip(entry.identityUrl, entry.path);
      return { n: countMessages(finalContent), sealed: finalContent.includes(CLOSING_MARKER), diskFull: false };
    } catch (e) {
      console.error("[wechat-diary] 网页剪藏入口写入日记失败:", e);
      return { n: 0, sealed: false, diskFull: String(e && e.message).includes("ENOSPC") };
    }
  }

  // 兼容单链接调用：保存剪藏后，原句和入口仍作为一个日记块落盘。
  // 返回 {n, sealed, path, title, reused}; n===0 表示日记入口没写成。
  async writeWebClip(article, originalText, note, dateStr) {
    const saved = await this.saveWebClip(article, note, dateStr);
    if (!saved.path) return { ...saved, n: 0, sealed: false };
    const appended = await this.appendWebClipEntries([saved], originalText, dateStr);
    return { ...saved, ...appended };
  }

  // 附件与日记同根、按年分子目录: 日记/attachments/2026/2026-08-12-2104-a3f1.jpg
  attachmentPath(dateStr, ext) {
    const name = dateStr + "-" + hhmmStr().replace(":", "") + "-" + randHex(4) + "." + ext;
    return normalizePath(this._attachmentDir(dateStr) + "/" + name);
  }

  // 带原名的附件路径(文件/视频/语音兜底用): 日记/attachments/2026/2026-08-19-2130-检查报告.pdf。
  // 原名保留(病历 PDF 靠名字找), 但要洗掉 wikilink/路径的毒字符; 超长截断保扩展名。
  attachmentPathNamed(dateStr, origName) {
    let name = String(origName || "").split(/[/\\]/).pop() || "";
    name = name.replace(/[\u0000-\u001f:*?"<>|#^\[\]]/g, "").trim();
    if (!name || /^\.+$/.test(name)) name = "file.bin";
    // 拆扩展名: 最后一个点(点在开头的「.pdf」残名让它整体当 base——拼上前缀后照样以 .pdf 结尾)
    const dot = name.lastIndexOf(".");
    let base, ext;
    if (dot > 0 && dot < [...name].length - 1) { base = name.slice(0, dot); ext = name.slice(dot); }
    else { base = name.replace(/\.+$/, "") || name; ext = ""; }
    // 扩展名超长(>12 字节)不是真扩展名, 并回 base; 整名控制在 ~160 字节内,
    // 给前缀+撞名重试后缀留余量, 免得撞文件系统 255 字节上限(审稿轮抓出)
    if (Buffer.byteLength(ext, "utf8") > 12) { base = (base + ext).split(".").join("-"); ext = ""; }
    let baseArr = [...base];
    if (baseArr.length > 40) base = baseArr.slice(0, 40).join("");
    while (Buffer.byteLength(base + ext, "utf8") > 160 && [...base].length > 1) {
      base = [...base].slice(0, Math.max(1, [...base].length - 8)).join("");
    }
    name = dateStr + "-" + hhmmStr().replace(":", "") + "-" + base + ext;
    return normalizePath(this._attachmentDir(dateStr) + "/" + name);
  }

  // 存一个二进制附件 + 在当天笔记里插一个 wikilink 块(marker 是块前缀, 语音兜底用 "🎤")。
  // 返回 { n, sealed, diskFull, path }; n===0 表示没写成。永不抛。
  async writeAttachment(buf, path, dateStr, marker, textAfter) {
    const day = dateStr || logicalTodayStr();
    const vault = this.plugin.app.vault;
    try {
      path = await this.resolveAttachmentPath(day, path);
      await this._ensureParents(path);
      // 同分钟同名撞车(极小概率): 加随机尾巴重试几次
      for (let i = 0; i < 5 && vault.getAbstractFileByPath(path); i++) {
        path = path.replace(/(\.[^./]*)?$/, (m) => "-" + randHex(4) + (m || ""));
      }
      await vault.createBinary(path, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } catch (e) {
      console.error("[wechat-diary] 存附件失败:", e);
      return { n: 0, diskFull: String(e && e.message).includes("ENOSPC"), path: "" };
    }
    try {
      // textAfter(语音原声块用): 契约同款清洗后接在链接下一行——同一个块 = 一条消息, 撤回一起撤
      let block = (marker ? marker + " " : "") + "![[" + path + "]]";
      if (textAfter) {
        const polished = String(textAfter).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(NORMALIZE_BLANK_RE, "\n").trim();
        if (polished) block += "\n" + polished;
      }
      const finalContent = await this._appendBlock(day, hhmmStr(), block);
      return { n: this._count(finalContent), sealed: finalContent.includes(CLOSING_MARKER), diskFull: false, path };
    } catch (e) {
      console.error("[wechat-diary] 附件插入日记失败:", e);
      // 附件已落盘只是没插进笔记——不删文件, 留给用户手动捞
      return { n: 0, diskFull: String(e && e.message).includes("ENOSPC"), path };
    }
  }

  // 只插一个指向已有文件的 wikilink 块(重复文件 md5 命中时复用, 绕 #193 解密坑)
  async appendLinkBlock(path, dateStr) {
    const day = dateStr || logicalTodayStr();
    try {
      const finalContent = await this._appendBlock(day, hhmmStr(), "![[" + path + "]]");
      return { n: this._count(finalContent), sealed: finalContent.includes(CLOSING_MARKER) };
    } catch (e) {
      console.error("[wechat-diary] 引用附件失败:", e);
      return { n: 0, sealed: false };
    }
  }

  async _ensureParents(path) {
    const vault = this.plugin.app.vault;
    const parts = path.split("/").slice(0, -1);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + "/" + p : p;
      if (!vault.getFolderByPath(cur)) await vault.createFolder(cur).catch(() => {});
    }
  }

  // 读-改-写。文件存在走 vault.process(原子); 不存在则 create, TOCTOU 输了转 process。
  // 返回最终全文。
  async _transform(path, fn) {
    const vault = this.plugin.app.vault;
    let file = vault.getFileByPath(path);
    if (file) return vault.process(file, fn);
    await this._ensureParents(path);
    const initial = fn("");
    try {
      await vault.create(path, initial);
      return initial;
    } catch (e) {
      file = vault.getFileByPath(path);
      if (!file) throw e;
      return vault.process(file, fn);
    }
  }

  firstPrefix(day) { return this._shared() ? firstOfDayPrefixShared(day || logicalTodayStr(), this._heading()) : FIRST_OF_DAY_PREFIX; }

  // 段数: 共用模式拿到的是节正文, 直接数; 独立模式的外来文件(不是插件建的, #15 B1)只数我们段头之后的块——
  // 否则第一条回执会把用户自己的段落数进"今天第 N 段"(送达确认信号不能虚报)
  _count(text) {
    if (!this._shared() && isForeignFile(text)) {
      const i = text.search(HEADER_RE_G);
      return i >= 0 ? countMessages(text.slice(i)) : 0;
    }
    return countMessages(text);
  }

  // ── 共用文件模式(#15/D13): 插件只认、只动当天每日笔记里「## <标题>」一节 ─────────
  // 统一入口。独立模式 = 现有 _transform(全文, 一字不改); 共用模式 = 只对节正文跑 fn, 节外逐字节不动。
  // 返回 fn 作用范围的最终文本(独立=全文, 共用=节正文), 调用方的段数/封存判断只看它。
  // opts.create: 文件不存在/没有节时允许创建——只有追加块的路径传 true; 撤回/封存/计数不建文件、不建节、不套模板。
  // 返回 null = 没文件或没节且不允许创建。
  async _editDay(day, fn, opts) {
    const create = !!(opts && opts.create);
    const path = this.diaryPath(day);
    const vault = this.plugin.app.vault;
    if (!this._shared()) {
      if (!create && !vault.getFileByPath(path)) return null;
      return this._transform(path, fn);
    }
    const heading = this._heading();
    let file = vault.getFileByPath(path);
    if (!file) {
      if (!create) return null;
      const body = trimBody(fn(""));
      try {
        await this._createDayFile(day, body);
        return body;
      } catch (e) {
        file = vault.getFileByPath(path);
        if (!file) throw e;
        // TOCTOU: 别人(每日笔记插件/Templater)刚建了它 → 走下面的普通 splice; 模板只在 create 路径用, 永不进 process
      }
    }
    if (!create) {
      // 撤回/封存: 先看有没有节, 没有就不碰文件(免得空操作也改 mtime 惊动同步盘)
      const cur = await vault.cachedRead(file);
      if (!locateSection(cur, heading)) return null;
    }
    let out = null;
    await vault.process(file, (content) => {
      const loc = locateSection(content, heading);
      if (!loc) {
        const body = trimBody(fn(""));
        out = body;
        return body ? appendSection(content, heading, body) : content;
      }
      const body = trimBody(normalizeNewlines(content.slice(loc.bodyStart, loc.bodyEnd)));
      const nb = trimBody(fn(body));
      out = nb;
      return nb === body ? content : spliceSection(content, loc, nb, heading);
    });
    return out;
  }

  // 当天的每日笔记不存在: 按用户模板渲染 + 我们那一节, **一次** create(模板本身含同名标题就填进去, 不会出现两个标题)。
  // body 为空 = 只建壳(附件接口/「打开今天的日记」用), 有模板写模板, 没模板建空文件。
  async _createDayFile(day, body) {
    const vault = this.plugin.app.vault;
    const path = this.diaryPath(day);
    const heading = this._heading();
    let tpl = "";
    const tp = String(this.plugin.settings.templatePath || "").trim();
    if (tp) {
      const tf = vault.getFileByPath(normalizePath(tp));
      let problem = "";
      if (tf) {
        try { tpl = await vault.cachedRead(tf); this.plugin._templateMissing = ""; } catch (e) { tpl = ""; problem = "读取失败"; console.error("[wechat-diary] 模板读取失败:", tp, e && e.message); }
      } else problem = "没找到";
      if (problem) {
        // 微信回执照常(内容确实记了), 但 Obsidian 侧要响亮: 微信先到的每一天都会丢模板——每个逻辑日提醒一次, 设置页 desc 标红
        this.plugin._templateMissing = tp;
        if (this.plugin._templateNoticedDay !== day) {
          this.plugin._templateNoticedDay = day;
          new Notice("微信随手记: 每日笔记模板" + problem + ": " + tp + " (今天的文件已按无模板创建)", 10000);
        }
      }
    }
    let content = tpl ? renderTemplate(tpl, { dateStr: day, now: new Date(), title: path.split("/").pop().replace(/\.md$/, ""), momentLib: moment }) : "";
    if (body) {
      const loc = locateSection(content, heading);
      content = loc ? spliceSection(content, loc, body, heading) : appendSection(content, heading, body);
    }
    await this._ensureParents(path);
    await vault.create(path, content);
    return content;
  }

  // ── Templater 竞态复核(共用模式) ──
  // 插件自己建的当天文件会被 Templater 的「新文件创建时触发」再处理一遍: 它 read→modify 整篇写回, 不看是谁建的,
  // 连发时窗口内写进节里的每一条都可能被快照抹掉, 而回执已说「记下来啦」。所以: 文件是插件建的(带正文建, 或先建壳再追加)
  // 之后写进节里的每一块都登记, 最后一次写入 1.5s 后读一次文件, 缺哪条按原顺序补哪条(连发只复核一次)。
  // 用户在窗口内「撤回」掉的块从清单里移除, 不补; 「撤回」时节已被抹掉(找不到节)的, 补回时丢掉最后一条——那正是用户想撤的;
  // 封存不作废: 补回正文后若本日真封存过, 再补封存行。(v1 用"任何撤回/封存都作废"会把「第一条+晚安」积压批次的第一条丢掉。)
  _registerPending(day, timestamp, block, fresh) {
    const plugin = this.plugin;
    let pc = plugin._pendingCheck;
    if (!pc || pc.day !== day) {
      if (!fresh) return;
      pc = plugin._pendingCheck = { day, items: [], timer: null, dropLast: false, sealed: false };
    }
    pc.items.push({ timestamp, block });
    const timerFn = (typeof window !== "undefined" && window.setTimeout) ? window.setTimeout : setTimeout;
    const clearFn = (typeof window !== "undefined" && window.clearTimeout) ? window.clearTimeout : clearTimeout;
    if (pc.timer) clearFn(pc.timer);
    pc.timer = timerFn(() => { this._runPendingCheck().catch((e) => console.error("[wechat-diary] 复核补写失败:", e && e.message)); }, 1500);
  }
  _pendingFor(day) {
    const pc = this.plugin._pendingCheck;
    return pc && pc.day === day ? pc : null;
  }
  async _runPendingCheck() {
    const plugin = this.plugin;
    const pc = plugin._pendingCheck;
    plugin._pendingCheck = null;
    if (!pc || plugin._unloaded || !this._shared()) return;
    const vault = plugin.app.vault;
    const file = vault.getFileByPath(this.diaryPath(pc.day));
    if (!file) return;
    const cur = await vault.cachedRead(file);
    const loc = locateSection(cur, this._heading());
    const body = loc ? normalizeNewlines(cur.slice(loc.bodyStart, loc.bodyEnd)) : "";
    let items = pc.items;
    if (pc.dropLast && items.length) items = items.slice(0, -1);
    const missing = items.filter((it) => !body.includes(it.block.trim()));
    if (!missing.length) return;
    console.warn("[wechat-diary] 建文件后节正文被别的插件覆盖, 补回 " + missing.length + " 条");
    for (const it of missing) await this._appendRaw(pc.day, it.timestamp, it.block);
    if (pc.sealed) await this.finalizeDay(pc.day);
    new Notice("微信随手记: 今天的每日笔记被别的插件覆盖过, 已补回 " + missing.length + " 条微信记录", 10000);
  }

  // 追加一个块。同一分钟共用段头, 文件不存在则连 frontmatter 一起建(共用模式: 不写 frontmatter/标题, 见 _editDay)。
  // 返回最终全文(共用模式: 节正文)。
  async _appendBlock(day, timestamp, block) {
    if (!this._shared()) return this._appendRaw(day, timestamp, block);
    block = escapeFenceLines(escapeHeadingLines(block)); // 块内任何 `#… `/``` 行都会破坏节的边界; 独立模式不动(零影响)
    const vault = this.plugin.app.vault;
    const existed = !!vault.getFileByPath(this.diaryPath(day));
    const out = await this._appendRaw(day, timestamp, block);
    const shell = this._freshShell;
    const fresh = !existed || !!(shell && shell.day === day && Date.now() - shell.ts < 3000);
    if (fresh) this._freshShell = null;
    this._registerPending(day, timestamp, block, fresh);
    return out;
  }
  _appendRaw(day, timestamp, block) {
    return this._editDay(day, (existing) => {
      if (existing) {
        const chunk = canMergeIntoLastHeader(existing, timestamp)
          ? "\n" + block + "\n"
          : "\n\n**" + timestamp + "**\n\n" + block + "\n";
        return existing + chunk;
      }
      if (this._shared()) return "**" + timestamp + "**\n\n" + block + "\n";
      const header = "---\n" +
        "date: " + day + "\n" +
        "weekday: " + weekdayForDate(day) + "\n" +
        "source: wechat-diary\n" +
        "---\n\n" +
        "# " + day + "\n";
      return header + "\n\n**" + timestamp + "**\n\n" + block + "\n";
    }, { create: true });
  }

  // 写一条。返回 { reply, n }。永不抛。
  // v0.3.0: 不再调 AI 润色, 原文直存——备忘录定位下润色是风险(病例数字被"润"了怎么办),
  // AiClient.polish 代码保留, 待润色作为显式开关回归时再接。
  async write(text, isVoice, dateStr) {
    text = (text || "").trim();
    if (!text) return { reply: "嗯? 没听清, 再说一次?", n: 0 };
    const day = dateStr || logicalTodayStr();

    // 契约规则 6: 块内空行收敛为单个换行, 一次发送 = 一个块 = 一条消息
    let polished = normalizeDiaryBlockText(text, !isVoice);
    if (isVoice) polished = "🎤 " + polished;
    const timestamp = hhmmStr();

    let finalContent;
    try {
      finalContent = await this._appendBlock(day, timestamp, polished);
    } catch (e) {
      console.error("[wechat-diary] 写日记失败:", e);
      // 【宿主适配】019 原文提的是「DIARY_DIR 所在盘」, 插件没有这个概念
      if (String(e && e.message).includes("ENOSPC")) return { reply: "⚠️ 这条没记上! 磁盘可能满了 💾 请检查磁盘空间", n: 0 };
      // 失败必须响亮: "收到啦"开头会让人误以为记上了——这条其实丢了
      return { reply: "⚠️ 这条没记上! 写入出了问题, 等一会儿重发一次", n: 0 };
    }

    const n = this._count(finalContent);
    const voiceMark = isVoice ? "🎤 " : "";
    let reply = voiceMark + "记下来啦~ 今天第 " + n + " 段 ✍️";
    if (n === 1) reply = this.firstPrefix(day) + reply + FIRST_OF_DAY_TIPS;
    // sealed: 今天已有封存标记(夜间收尾提示据此闭嘴)
    return { reply, n, sealed: finalContent.includes(CLOSING_MARKER) };
  }

  // 数今天(或指定日)已记的段数; 探活回执用。读不到按 0 算, 永不抛。
  async countDay(dateStr) {
    try {
      const vault = this.plugin.app.vault;
      const path = this.diaryPath(dateStr || logicalTodayStr());
      const file = vault.getFileByPath ? vault.getFileByPath(path) : vault.getAbstractFileByPath(path);
      if (!file) return 0;
      const content = await vault.cachedRead(file);
      if (this._shared()) {
        const loc = locateSection(content, this._heading());
        return loc ? countMessages(normalizeNewlines(content.slice(loc.bodyStart, loc.bodyEnd))) : 0;
      }
      return this._count(content); // 外来文件(#15 B1)只数我们段头之后的块
    } catch (e) { return 0; }
  }

  // 存一张图: 落进 vault 附件目录, 日记里插一个 ![[]] 块。
  // 返回 { n, diskFull }; n === 0 表示没写成。永不抛。
  async writeImage(buf, ext, dateStr) {
    const day = dateStr || logicalTodayStr();
    const timestamp = hhmmStr();
    const vault = this.plugin.app.vault;
    let path = "";
    try {
      path = this.attachmentPath(day, ext);
      // 同一分钟连发多图时 4 位随机撞名的概率极小, 但撞了就是覆盖别人的图, 重摇几次
      for (let i = 0; i < 5 && vault.getAbstractFileByPath(path); i++) path = this.attachmentPath(day, ext);
      path = await this.resolveAttachmentPath(day, path); // obsidian 模式换算到用户设的位置(先换算再建目录, 别留空文件夹)
      await this._ensureParents(path);
      // Buffer 是内存池上的视图, 直接给 .buffer 会把整个池子写进去, 必须切出自己那段
      await vault.createBinary(path, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } catch (e) {
      console.error("[wechat-diary] 存图片失败:", e);
      return { n: 0, diskFull: String(e && e.message).includes("ENOSPC") };
    }

    let finalContent;
    try {
      // 完整 vault 路径的 wikilink: 不依赖用户的"最短路径"链接设置, 重名附件也不会指错
      finalContent = await this._appendBlock(day, timestamp, "![[" + path + "]]");
    } catch (e) {
      console.error("[wechat-diary] 图片插入日记失败:", e);
      // 图已经落盘了, 只是没插进笔记 —— 不删文件, 留给用户手动捞
      return { n: 0, diskFull: String(e && e.message).includes("ENOSPC") };
    }
    return { n: this._count(finalContent), diskFull: false, sealed: finalContent.includes(CLOSING_MARKER) };
  }

  // 撤回最后一条消息; 孤儿段头一并清理。返回是否删了东西。
  // 返回 { ok, removed }: removed = 被删块的原文(回执预览用), 失败/无可撤时 null。
  async undoLastBlock(dateStr) {
    const day = dateStr || logicalTodayStr();
    const path = this.diaryPath(day);
    const vault = this.plugin.app.vault;
    let ok = false;
    let removed = null;
    let foreign = false;
    try {
      if (this._shared()) {
        // 共用模式: 只在节正文里撤; 没文件/没节 → 没东西可撤; 撤到空只清正文, 标题行留着(可能是用户写在模板里的)
        const r = await this._editDay(day, (body) => {
          const res = removeLastBlock(body);
          if (res.ok) { ok = true; removed = res.removed; }
          return res.content;
        }, { create: false });
        const pc = this._pendingFor(day);
        if (r === null) { if (pc) pc.dropLast = true; return { ok: false, removed: null }; } // 节刚被抹掉: 复核补回时丢掉最后一条
        if (ok && pc) { const k = pc.items.findIndex((it) => it.block.trim() === removed); if (k >= 0) pc.items.splice(k, 1); }
      } else {
        const file = vault.getFileByPath(path);
        if (!file) return { ok: false, removed: null };
        await vault.process(file, (content) => {
          // 外来文件护栏(#15 B1): 不是插件建的文件(没有 source: wechat-diary 的 frontmatter)——只有我们段头之后没有块时才拒;
          // 有块时全文最后一个消息块必在段头之后, removeLastBlock 只删它和孤儿段头, 用户段头之前的内容原样保留(与 0.3.1 结果一致)
          if (isForeignFile(content)) {
            const i = content.search(HEADER_RE_G);
            if (i < 0 || !countMessages(content.slice(i))) { foreign = true; return content; }
          }
          const res = removeLastBlock(content);
          if (res.ok) { ok = true; removed = res.removed; }
          return res.content;
        });
      }
    } catch (e) {
      console.error("[wechat-diary] 撤回失败:", e);
      return { ok: false, removed: null };
    }
    if (foreign) return { ok: false, removed: null, foreign: true };
    return { ok, removed: ok ? removed : null };
  }

  // 封存。返回 { status, n, afterSeal }: status = "sealed"(这次真写了标记) | "already"(本来就有, 幂等不重写)
  // | "empty"(今天没内容, 不写) | "error"; n=当天段数; afterSeal=封存线之后又补记的段数。
  // 调用方据此区分: 跨天"自动收尾"告知只给没自己收尾的人; 告别语回"补的也收好了"还是只道别。
  async finalizeDay(dateStr) {
    const day = dateStr || logicalTodayStr();
    const path = this.diaryPath(day);
    const vault = this.plugin.app.vault;
    let status = "empty", n = 0, afterSeal = 0;
    const fn = (content) => {
      // 外来文件(#15 B1, 独立模式): 我们段头之后没有块就不落笔(不往用户的每日笔记里塞封存行), 有块时段数只数段头之后
      if (!this._shared() && isForeignFile(content)) {
        const i = content.search(HEADER_RE_G);
        const own = i >= 0 ? countMessages(content.slice(i)) : 0;
        if (!own) { status = "empty"; n = 0; afterSeal = 0; return content; }
        const r = sealContent(content, hhmmStr());
        status = r.status; n = own; afterSeal = r.afterSeal;
        return r.content;
      }
      const r = sealContent(content, hhmmStr());
      status = r.status; n = r.n; afterSeal = r.afterSeal;
      return r.content;
    };
    try {
      if (this._shared()) {
        // 共用模式: 封存行写在节正文末尾; 没文件/没节 → empty, 不建文件不建节
        const r = await this._editDay(day, fn, { create: false });
        if (r === null) return { status: "empty", n: 0, afterSeal: 0 };
      } else {
        const file = vault.getFileByPath(path);
        if (!file) return { status: "empty", n: 0, afterSeal: 0 };
        await vault.process(file, fn);
      }
    } catch (e) {
      console.error("[wechat-diary] 封存失败:", e);
      return { status: "error", n, afterSeal };
    }
    if (status === "sealed" && this._shared()) { const pc = this._pendingFor(day); if (pc) pc.sealed = true; }
    return { status, n, afterSeal };
  }
}

// ── 媒体: CDN 解密与格式识别(对齐官方 src/cdn/, src/media/)──────────────

function getHttps() {
  if (!Platform.isDesktop) throw new Error("WeChat Diary 仅支持桌面端");
  return require("https");
}

function getCrypto() {
  if (!Platform.isDesktop) throw new Error("WeChat Diary 仅支持桌面端");
  return require("crypto");
}

// 取图片的 AES-128 key。认不出就返回 null → 按明文处理(同官方 downloadPlainCdnBuffer 分支)。
function parseImageAesKey(img) {
  // 官方注释: inbound 优先用 image_item.aeskey(16 字节的 hex), 它比 media.aes_key 可靠
  const hex = String((img && img.aeskey) || "").trim();
  if (/^[0-9a-fA-F]{32}$/.test(hex)) return Buffer.from(hex, "hex");
  const b64 = img && img.media && img.media.aes_key;
  if (!b64) return null;
  const decoded = Buffer.from(String(b64), "base64");
  if (decoded.length === 16) return decoded;                 // 图片: base64(裸 16 字节)
  // 文件/语音走的是 base64(32 位 hex 字符串) —— 同一个字段两种编码, 官方 parseAesKey 也要分流
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString("ascii"))) {
    return Buffer.from(decoded.toString("ascii"), "hex");
  }
  return null;
}

function decryptAesEcb(ciphertext, key) {
  const crypto = getCrypto();
  try {
    const d = crypto.createDecipheriv("aes-128-ecb", key, null);
    return Buffer.concat([d.update(ciphertext), d.final()]);
  } catch (e) {
    // 尾块不是标准 PKCS7 时 final() 会抛; 关掉去填充再来一次, 多出来的尾字节不影响图片解码。
    // 真解错了(key 不对)下游 sniffImageExt 会认不出格式, 兜得住。
    const d2 = crypto.createDecipheriv("aes-128-ecb", key, null);
    d2.setAutoPadding(false);
    return Buffer.concat([d2.update(ciphertext), d2.final()]);
  }
}

// 按 magic bytes 判图片类型。返回扩展名或 null。
// 兼职做解密校验: 认不出 = 要么不是图, 要么 key 错了, 两种都不该往库里写。
function sniffImageExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12).toLowerCase();
    if (brand.startsWith("hei") || brand.startsWith("hev") || brand === "mif1" || brand === "msf1") return "heic";
    if (brand.startsWith("avi")) return "avif";
  }
  return null;
}

// 音频格式嗅探(语音兜底用): 微信语音大概率 SILK v3, 认不出按 encode_type 兜底
// (voice_item.encode_type: 1=pcm..6=silk, 7=mp3, 8=ogg-speex, 对齐官方 types.ts)
function sniffAudioExt(buf, encodeType) {
  if (buf && buf.length > 12) {
    const head = buf.toString("ascii", 0, 10);
    if (head.includes("#!SILK")) return "silk";
    if (head.startsWith("#!AMR")) return "amr";
    if (head.startsWith("OggS")) return "ogg";
    if (head.startsWith("ID3") || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "mp3";
    if (head.startsWith("RIFF") && buf.toString("ascii", 8, 12) === "WAVE") return "wav";
  }
  return { 6: "silk", 7: "mp3", 8: "ogg" }[encodeType] || "bin";
}

function md5Hex(buf) {
  return getCrypto().createHash("md5").update(buf).digest("hex").toLowerCase();
}

// ── SILK → WAV(D12): 微信语音是 SILK v3, Obsidian 播不了; 解码走内嵌 silk-wasm(文件末尾), 封装成 PCM WAV ──
const SILK_WAV_SAMPLE_RATE = 24000; // 官方 silk-transcode.ts 同款口径
function pcmToWav(pcm, sampleRate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);              // PCM
  h.writeUInt16LE(1, 22);              // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); // byteRate = rate * 2B * 1ch
  h.writeUInt16LE(2, 32);              // blockAlign
  h.writeUInt16LE(16, 34);             // 16bit
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
// 微信 SILK 带 0x02 前缀变体; 无前缀的裸 #!SILK 解码器不认, 规范化成恰好一个 0x02(生态调查实测)。
// 不是 SILK(mp3/ogg 等)返回 null, 调用方自行兜底。永不抛。
async function silkToWav(buf) {
  try {
    if (!buf || buf.length < 8) return null;
    let b = buf;
    if (b[0] !== 0x02) {
      if (b.slice(0, 7).toString("ascii").includes("#!SILK")) b = Buffer.concat([Buffer.from([0x02]), b]);
      else return null;
    }
    const lib = getSilkLib();
    if (!lib) return null;
    const r = await lib.decode(b, SILK_WAV_SAMPLE_RATE);
    // 仅魔数/垃圾输入会"成功"解出几十毫秒噪声——<0.2 秒按失败算, 兜底路径才能保住原始字节
    if (!r || !r.data || r.data.length < SILK_WAV_SAMPLE_RATE * 0.4) return null;
    return pcmToWav(Buffer.from(r.data.buffer, r.data.byteOffset, r.data.byteLength), SILK_WAV_SAMPLE_RATE);
  } catch (e) {
    console.warn("[wechat-diary] SILK 解码失败(存原始音频兜底):", e && e.message);
    return null;
  }
}

// ── iLink 协议客户端(对齐官方 openclaw-weixin 2.4.6; Node https 直连)────

function respCode(o) {
  if (!o || typeof o !== "object") return 0;
  if (typeof o.ret === "number" && o.ret !== 0) return o.ret;
  if (typeof o.errcode === "number" && o.errcode !== 0) return o.errcode;
  return 0;
}

class ILinkClient {
  constructor() {
    const https = getHttps();
    // keepAlive 复用连接: 35s 一轮、全天几千轮, 省 TLS 握手
    this._agent = new https.Agent({ keepAlive: true, maxSockets: 2 });
    this._inflight = new Set();
    this.token = "";
    this.baseUrl = "";
  }

  destroyAll() {
    for (const req of this._inflight) { try { req.destroy(); } catch (e) { /* 已关闭 */ } }
    this._inflight.clear();
    try { this._agent.destroy(); } catch (e) { /* noop */ }
  }

  _commonHeaders() {
    return { "iLink-App-Id": "bot", "iLink-App-ClientVersion": CLIENT_VERSION_HEADER };
  }

  _postHeaders(bodyBuf) {
    const headers = Object.assign(this._commonHeaders(), {
      "Content-Type": "application/json",
      // 官方无条件发 AuthorizationType, 哪怕还没有 token
      "AuthorizationType": "ilink_bot_token",
      // 每请求重新随机, 不参与鉴权, 勿试图稳定它
      "X-WECHAT-UIN": btoa(String(Math.floor(Math.random() * 0xffffffff) >>> 0)),
      // Node 核心 http 不自动算请求 Content-Length; 019(urllib)与官方(undici)线上流量
      // 都带 CL, 服务端未验证过 chunked, 故这里按 Buffer 字节数显式给出
      "Content-Length": String(bodyBuf.length),
    });
    if (this.token && this.token.trim()) headers["Authorization"] = "Bearer " + this.token;
    return headers;
  }

  // 通用请求。resolve { status, json } 或 { __timeout: true }; 网络错误 reject。
  _raw(base, endpoint, { method, bodyObj, timeoutMs }) {
    const https = getHttps();
    const url = new URL(endpoint, base.endsWith("/") ? base : base + "/");
    const isPost = method === "POST";
    const bodyBuf = isPost ? Buffer.from(JSON.stringify(bodyObj || {}), "utf8") : null;
    const headers = isPost ? this._postHeaders(bodyBuf) : this._commonHeaders();
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      const done = (fn, v) => { if (!settled) { settled = true; window.clearTimeout(timer); this._inflight.delete(req); fn(v); } };
      const req = https.request(url, { method, headers, agent: this._agent }, (res) => {
        res.setEncoding("utf8");
        let raw = "";
        res.on("data", (d) => { raw += d; });
        res.on("aborted", () => { timedOut ? done(resolve, { __timeout: true }) : done(reject, new Error("aborted")); });
        res.on("end", () => {
          // 官方对 !res.ok 一律 throw; 网关 5xx 的 JSON 体不能当业务成功
          if (res.statusCode < 200 || res.statusCode >= 300) {
            done(reject, new Error("HTTP " + res.statusCode + ": " + raw.slice(0, 120)));
            return;
          }
          let json = null;
          try { json = JSON.parse(raw); } catch (e) { /* 非 JSON, 保留 null */ }
          if (json === null) {
            done(reject, new Error("HTTP " + res.statusCode + " 非 JSON 响应: " + raw.slice(0, 120)));
            return;
          }
          done(resolve, { status: res.statusCode, json });
        });
      });
      this._inflight.add(req);
      const timer = window.setTimeout(() => { timedOut = true; try { req.destroy(new Error("ilink-timeout")); } catch (e) { /* noop */ } }, timeoutMs);
      req.on("error", (err) => { timedOut ? done(resolve, { __timeout: true }) : done(reject, err); });
      if (bodyBuf) req.end(bodyBuf); else req.end();
    });
  }

  _baseInfo() { return { channel_version: CHANNEL_VERSION, bot_agent: BOT_AGENT }; }

  // 取二维码永远打固定域名(即使重登录)。localTokens: 本机已有 token 列表。
  async getQrcode(localTokens) {
    const r = await this._raw(FIXED_BASE_URL, "ilink/bot/get_bot_qrcode?bot_type=3", {
      method: "POST",
      bodyObj: { local_token_list: localTokens || [], base_info: this._baseInfo() },
      timeoutMs: QR_FETCH_TIMEOUT_MS,
    });
    if (r.__timeout) throw new Error("取二维码超时");
    const code = respCode(r.json);
    if (code !== 0) throw new Error("取二维码失败 ret=" + code + " " + (r.json.errmsg || ""));
    return { qrcode: r.json.qrcode, qrPageUrl: r.json.qrcode_img_content };
  }

  // 轮询一次扫码状态。GET 只带通用头。pollBase 可被 scaned_but_redirect 换掉。
  async pollQrStatus(pollBase, qrcode, verifyCode) {
    let ep = "ilink/bot/get_qrcode_status?qrcode=" + encodeURIComponent(qrcode);
    if (verifyCode) ep += "&verify_code=" + encodeURIComponent(verifyCode);
    return this._raw(pollBase, ep, { method: "GET", timeoutMs: LONG_POLL_TIMEOUT_MS });
  }

  apiBase() { return this.baseUrl || FIXED_BASE_URL; }

  async getUpdates(buf, timeoutMs) {
    return this._raw(this.apiBase(), "ilink/bot/getupdates", {
      method: "POST",
      bodyObj: { get_updates_buf: buf || "", base_info: this._baseInfo() },
      timeoutMs: timeoutMs || LONG_POLL_TIMEOUT_MS,
    });
  }

  // 发文本。contextToken 没有就省略字段(官方: warn 后照发, 绝不做本地新鲜度预判)。
  async sendText(toUserId, text, contextToken) {
    const chunks = [];
    const arr = [...(text || "")];
    for (let i = 0; i < arr.length; i += 4000) chunks.push(arr.slice(i, i + 4000).join(""));
    for (const chunk of chunks) {
      if (!chunk) continue;
      const msg = {
        from_user_id: "",
        to_user_id: toUserId,
        client_id: AGENT_NAME + ":" + Date.now() + "-" + randHex(8),
        message_type: 2,   // BOT
        message_state: 2,  // FINISH
        item_list: [{ type: 1, text_item: { text: chunk } }],
      };
      if (contextToken) msg.context_token = contextToken;
      const r = await this._raw(this.apiBase(), "ilink/bot/sendmessage", {
        method: "POST",
        bodyObj: { msg, base_info: this._baseInfo() },
        timeoutMs: SEND_TIMEOUT_MS,
      });
      if (r.__timeout) throw new Error("发送超时");
      const code = respCode(r.json);
      if (code !== 0) { const e = new Error("发送失败 ret=" + code); e.ilinkCode = code; throw e; }
    }
    return true;
  }

  // CDN 二进制下载。裸 GET, 不带任何 iLink 鉴权头(同官方: CDN 用的是 URL 里的加密参数)。
  // 不复用 this._agent: 那个 maxSockets=2 是留给长轮询的, 大图会把长轮询挤掉。
  _rawBinary(urlStr, timeoutMs, hop) {
    const https = getHttps();
    return new Promise((resolve, reject) => {
      let settled = false;
      const chunks = [];
      let total = 0;
      const done = (fn, v) => { if (!settled) { settled = true; window.clearTimeout(timer); this._inflight.delete(req); fn(v); } };
      const req = https.request(new URL(urlStr), { method: "GET" }, (res) => {
        const code = res.statusCode;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume(); // 丢弃 body, 否则连接不释放
          if ((hop || 0) >= MEDIA_MAX_REDIRECTS) { done(reject, new Error("CDN 重定向过多")); return; }
          const next = new URL(res.headers.location, urlStr).toString();
          done(resolve, { __redirect: next });
          return;
        }
        if (code < 200 || code >= 300) {
          res.resume();
          done(reject, new Error("CDN HTTP " + code));
          return;
        }
        const declared = Number(res.headers["content-length"] || 0);
        if (declared > MEDIA_MAX_BYTES) {
          res.resume();
          done(reject, new Error("图片超过 100MB, 不收"));
          return;
        }
        res.on("data", (d) => {
          total += d.length;
          if (total > MEDIA_MAX_BYTES) {
            try { req.destroy(new Error("media-too-large")); } catch (e) { /* noop */ }
            done(reject, new Error("图片超过 100MB, 不收"));
            return;
          }
          chunks.push(d);
        });
        res.on("aborted", () => done(reject, new Error("下载中断")));
        res.on("end", () => done(resolve, { __buf: Buffer.concat(chunks) }));
      });
      this._inflight.add(req);
      const timer = window.setTimeout(() => {
        try { req.destroy(new Error("media-timeout")); } catch (e) { /* noop */ }
        done(reject, new Error("图片下载超时"));
      }, timeoutMs);
      req.on("error", (err) => done(reject, err));
      req.end();
    });
  }

  // 收图: 取 URL → 下载 → AES-128-ECB 解密。返回明文 Buffer, 失败抛错。
  // 通用媒体下载: image_item / voice_item / file_item / video_item 结构同为 {media, aeskey?}。
  // 图片有明文投递路径(无 key 直接返回原文); 文件/语音/视频没有——requireKey 时缺 key 直接失败,
  // 免得把密文当内容写进库(对齐官方 media-download.ts 的硬性要求)。
  async downloadMedia(item, requireKey) {
    const media = (item && item.media) || null;
    // 官方优先用服务端下发的 full_url; 没有才客户端拼(ENABLE_CDN_URL_FALLBACK)
    let url = String((media && media.full_url) || "").trim();
    if (!url && media && media.encrypt_query_param) {
      url = CDN_BASE_URL + "/download?encrypted_query_param=" + encodeURIComponent(media.encrypt_query_param);
    }
    if (!url) throw new Error("没有下载地址");
    const key = parseImageAesKey(item);
    if (!key && requireKey) throw new Error("没有解密密钥");

    let r;
    for (let hop = 0; ; hop++) {
      r = await this._rawBinary(url, requireKey ? MEDIA_TIMEOUT_LONG_MS : MEDIA_TIMEOUT_MS, hop);
      if (!r.__redirect) break;
      url = r.__redirect;
    }
    return key ? decryptAesEcb(r.__buf, key) : r.__buf;
  }

  async downloadImage(img) { return this.downloadMedia(img, false); }

  // 上下线通知: 失败只记日志, 不阻塞(同官方)
  notify(which) {
    this._raw(this.apiBase(), "ilink/bot/msg/" + which, {
      method: "POST", bodyObj: { base_info: this._baseInfo() }, timeoutMs: NOTIFY_TIMEOUT_MS,
    }).catch((e) => console.warn("[wechat-diary] " + which + " 失败(忽略):", e && e.message));
  }
}

// ── 会话状态机 + 消息路由(019 main.py/session_state.py + 020 两处修复)──

class DiaryAgent {
  // plugin 提供: settings / persist() / data.profile / data.session / ai / writer / chatHandler
  constructor(plugin) {
    this.plugin = plugin;
    this.ai = plugin.ai;
    this.writer = plugin.writer;
    this.chatHandler = plugin.chatHandler;
    this.offlineNotice = null; // 启动时算好, 第一条回复后清空
  }

  get profile() { return this.plugin.data.profile; }
  get session() { return this.plugin.data.session; }

  _welcome() { return this.writer._shared() ? welcomeTextShared(this.writer._heading()) : welcomeText(this.plugin.settings.diaryFolder || "日记"); }

  // 跨天处理(020「午夜割裂」修复: 宽限期 + 显式告知)。
  // 返回 { graceDate?: string, expiredNotice?: string }
  // 跨天处理(契约 v1.2): 一天的边界=凌晨 dayStartHour 点, 滚动宽限期(graceMinutes)退役——
  // 凌晨 1 点新开一段也算前一晚, 规则一句话讲得清。
  // session.mode / chat_count_today 自 0.3.0 起不读不写(字段留在 data.json 兼容老数据)。
  async _loadOrReset() {
    const s = this.session;
    const today = logicalTodayStr();
    if (!s.entered_date) { s.entered_date = today; return {}; }
    if (s.entered_date === today) return {};
    // 逻辑日翻页: 自动封存旧的一天(空文件无副作用)。只有这次真写了标记才告知"自动收尾"——
    // 用户昨晚自己说了「晚安」/「结束」的, 句号已经给过了, 不能反过来说是自动收的(2026-08-19 修)
    const prev = s.entered_date;
    const r = await this.writer.finalizeDay(prev);
    s.entered_date = today;
    if (!(r && r.status === "sealed")) return {};
    return { expiredNotice: this.writer._shared() ? expiredNoticeShared(prev) : GRACE_EXPIRED_NOTICE };
  }

  // 写成功后的公共记账: 夜间收尾提示的依据 + 每日提醒的"没写"计数清零。
  // _writeGen 是单调写入代数: 提醒发送在途时若有新写入, 发完不能把 streak 反手写回(审稿轮抓出的竞态)
  _noteWrite(n, sealed) {
    this._lastWrite = { n, sealed: !!sealed };
    this.session.reminder_streak = 0;
    this.plugin._writeGen = (this.plugin._writeGen || 0) + 1;
  }

  async _writeEntry(text, isVoice, dateStr) {
    this.session.last_activity_ts = Date.now();
    // 语音原声(D12): 开关开着且这条带语音、意图是记录 → 原声+文字同块(文字含同条打字部分);
    // 任何失败静默降级纯文字(文字是本体, 音频是增强)
    if (this._pendingVoiceAudio) {
      const v = this._pendingVoiceAudio;
      this._pendingVoiceAudio = null;
      const reply = await this._writeVoiceEntry(text, v, dateStr);
      if (reply) return reply;
    }
    const res = await this.writer.write(text, isVoice, dateStr);
    if (res.n) this._noteWrite(res.n, res.sealed);
    return res.reply;
  }

  // 语音原声块: 下载 → SILK 解码 WAV → 「🎤 ![[..wav]] + 转写文字」一块落库。失败返回 null(调用方降级)。
  async _writeVoiceEntry(text, v, dateStr) {
    const client = this.plugin._client;
    if (!client) return null;
    try {
      const raw = await client.downloadMedia(v, true);
      const wav = await silkToWav(raw);
      if (!wav) return null;
      const day = dateStr || logicalTodayStr();
      const path = this.writer.attachmentPathNamed(day, "语音.wav");
      const res = await this.writer.writeAttachment(wav, path, day, "🎤", text);
      if (!res.n) return null;
      this._noteWrite(res.n, res.sealed);
      let reply = "🎤 记下来啦~ 今天第 " + res.n + " 段 ✍️";
      if (res.n === 1) reply = this.writer.firstPrefix(day) + reply + FIRST_OF_DAY_TIPS;
      return reply;
    } catch (e) {
      console.error("[wechat-diary] 语音原声保存失败, 降级纯文字:", e && e.message);
      return null;
    }
  }

  async _clipLinks(text, urls, dateStr) {
    this.session.last_activity_ts = Date.now();
    const picked = (urls || []).slice(0, WEB_CLIP_MAX_LINKS_PER_MESSAGE);
    const overflow = (urls || []).slice(WEB_CLIP_MAX_LINKS_PER_MESSAGE);
    const note = linkNoteFromText(text, urls);
    const clipReplies = [];
    const failed = [];
    const entries = [];
    let writeN = 0;
    let originalWritten = false;
    let noteWritten = false;

    for (const url of picked) {
      try {
        const article = await this.plugin.clipper.fetchArticle(url);
        const res = await this.writer.saveWebClip(article, noteWritten ? "" : note, dateStr);
        if (!res.path) {
          failed.push({ url, reason: res.diskFull ? "磁盘空间不足" : "保存剪藏文件失败" });
          continue;
        }
        entries.push(res);
        if (!res.reused && note) noteWritten = true;
        clipReplies.push(res.reused
          ? "网页《" + res.title + "》之前存过，已复用 " + this.writer.webClipFolder() + " 中的剪藏"
          : "网页《" + res.title + "》已存到 " + this.writer.webClipFolder() + " 文件夹");
      } catch (e) {
        console.error("[wechat-diary] 网页正文抓取失败:", e && e.message);
        failed.push({ url, reason: (e && e.message) || "未知错误" });
      }
    }
    for (const url of overflow) failed.push({ url, reason: "一条消息最多自动剪藏 " + WEB_CLIP_MAX_LINKS_PER_MESSAGE + " 个链接" });

    // 所有成功入口攒齐后，与原句一次写成一个日记块。
    if (entries.length) {
      const appended = await this.writer.appendWebClipEntries(entries, text, dateStr);
      if (appended.n) {
        originalWritten = true;
        writeN = appended.n;
        this._noteWrite(appended.n, appended.sealed);
      } else {
        failed.push({ url: "", reason: appended.diskFull ? "磁盘空间不足，日记入口未写入" : "日记入口写入失败" });
      }
    }

    // 全部剪藏失败时仍保留原句；入口写失败也尽量让原句不丢。
    if (!originalWritten) {
      const saved = await this.writer.write(text, false, dateStr);
      if (saved.n) {
        originalWritten = true;
        writeN = saved.n;
        this._noteWrite(saved.n, saved.sealed);
      }
    }

    let reply = writeN ? "记下来啦~ 今天第 " + writeN + " 段 ✍️" : "⚠️ 原句没能写入日记，请稍后重发";
    if (clipReplies.length) reply += "\n" + clipReplies.join("\n");
    if (failed.length) {
      const reason = failed.length === 1 ? failed[0].reason : failed.length + " 个链接未能提取";
      reply += "\n⚠️ " + reason + "；" + (originalWritten ? "原句已记入今天的日记" : "请稍后重发");
    }
    if (writeN === 1) reply = FIRST_OF_DAY_PREFIX + reply + FIRST_OF_DAY_TIPS;
    return reply;
  }

  // 下载并写入一批图片。一张失败不连累其余。
  async _writeImages(images, dateStr) {
    this.session.last_activity_ts = Date.now();
    const client = this.plugin._client;
    if (!client) return IMAGE_FAIL_REPLY;
    let ok = 0, failed = 0, lastN = 0, lastSealed = false, diskFull = false;
    for (const img of images) {
      try {
        const buf = await client.downloadImage(img);
        const ext = sniffImageExt(buf);
        if (!ext) throw new Error("认不出图片格式(多半是解密失败)");
        const res = await this.writer.writeImage(buf, ext, dateStr);
        if (!res.n) { if (res.diskFull) diskFull = true; throw new Error("写入失败"); }
        ok += 1;
        lastN = res.n;
        lastSealed = !!res.sealed;
      } catch (e) {
        failed += 1;
        console.error("[wechat-diary] 处理图片失败:", e && e.message);
      }
    }
    if (!ok) return diskFull ? IMAGE_DISK_FULL_REPLY : IMAGE_FAIL_REPLY;
    this._noteWrite(lastN, lastSealed);
    let reply = imageWrittenReply(lastN);
    if (lastN === 1) reply = this.writer.firstPrefix(dateStr) + reply + FIRST_OF_DAY_TIPS;
    if (failed) reply = IMAGE_PARTIAL_TEMPLATE.split("{n}").join(String(failed)) + "\n\n" + reply;
    return reply;
  }

  // 语音兜底: 转写失败但有原音频 → 下载存附件("什么都别丢", D10)。返回回执, 永不抛。
  async _writeVoiceFallback(v, dateStr) {
    this.session.last_activity_ts = Date.now();
    const client = this.plugin._client;
    if (!client) return VOICE_FALLBACK_FAIL_REPLY;
    try {
      const buf = await client.downloadMedia(v, true);
      const day = dateStr || logicalTodayStr();
      // 先试解码成能播的 WAV(D12); 解不开(非 SILK/解码器失败)存原始字节, "什么都别丢"
      const wav = await silkToWav(buf);
      const ext = wav ? "wav" : sniffAudioExt(buf, v.encode_type);
      const path = this.writer.attachmentPathNamed(day, "语音." + ext);
      const res = await this.writer.writeAttachment(wav || buf, path, day, "🎤");
      if (!res.n) return res.diskFull ? ATTACH_DISK_FULL_REPLY : VOICE_FALLBACK_FAIL_REPLY;
      this._noteWrite(res.n, res.sealed);
      return this._decorateFirst(voiceFallbackReply(res.n), res.n);
    } catch (e) {
      console.error("[wechat-diary] 语音兜底失败:", e && e.message);
      return VOICE_FALLBACK_FAIL_REPLY;
    }
  }

  // 文件/视频接收(D10)。md5 双重用途: ①解密校验(解出来对不上=密钥错了, 别把密文写进库);
  // ②重复文件复用——微信 CDN 对重复内容复用旧密文却下发新随机 key, 重发同一文件必解密失败(#193),
  // 靠"md5 见过 → 直接引用本地那份"绕过。返回回执, 永不抛。
  async _writeFileItem(fi, isVideo, dateStr) {
    this.session.last_activity_ts = Date.now();
    const client = this.plugin._client;
    if (!client) return isVideo ? VIDEO_FAIL_REPLY : FILE_FAIL_REPLY;
    const day = dateStr || logicalTodayStr();
    const md5 = String((isVideo ? fi.video_md5 : fi.md5) || "").toLowerCase();
    const declaredLen = Number((isVideo ? fi.video_size : fi.len) || 0);
    if (declaredLen > MAX_MEDIA_BYTES) return isVideo ? VIDEO_TOO_BIG_REPLY : FILE_TOO_BIG_REPLY;

    // md5 命中且文件还在 → 不下载, 直接引用
    const known = md5 ? this._findKnownMd5(md5) : null;
    if (known) {
      const r = await this.writer.appendLinkBlock(known, day);
      if (r.n) { this._noteWrite(r.n, r.sealed); return this._decorateFirst(isVideo ? videoReusedReply(r.n) : fileReusedReply(r.n), r.n); }
      return isVideo ? VIDEO_FAIL_REPLY : FILE_FAIL_REPLY;
    }

    let buf;
    try {
      buf = await client.downloadMedia(fi, true);
    } catch (e) {
      console.error("[wechat-diary] 下载" + (isVideo ? "视频" : "文件") + "失败:", e && e.message);
      return isVideo ? VIDEO_FAIL_REPLY : FILE_FAIL_REPLY;
    }
    // 解密校验: 服务端给了明文 md5 就核对; 对不上=拿到的 key 解不开这份密文(大概率 #193)
    if (md5 && md5Hex(buf) !== md5) {
      console.error("[wechat-diary] " + (isVideo ? "视频" : "文件") + " md5 不符, 疑似重复文件解密坑(#193)");
      return isVideo ? VIDEO_DUP_KEY_REPLY : FILE_DUP_KEY_REPLY;
    }
    const origName = isVideo ? "视频.mp4" : (fi.file_name || "file.bin");
    const path = this.writer.attachmentPathNamed(day, origName);
    const res = await this.writer.writeAttachment(buf, path, day, "");
    if (!res.n) return res.diskFull ? ATTACH_DISK_FULL_REPLY : (isVideo ? VIDEO_FAIL_REPLY : FILE_FAIL_REPLY);
    this._noteWrite(res.n, res.sealed);
    if (md5) this._rememberMd5(md5, res.path);
    const reply = isVideo ? videoWrittenReply(res.n) : fileWrittenReply((fi.file_name || "文件").replace(/[「」]/g, ""), res.n);
    return this._decorateFirst(reply, res.n);
  }

  _decorateFirst(reply, n) {
    return n === 1 ? this.writer.firstPrefix() + reply + FIRST_OF_DAY_TIPS : reply;
  }

  _findKnownMd5(md5) {
    const il = this.plugin.data.ilink;
    const list = Array.isArray(il.fileMd5s) ? il.fileMd5s : [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] && list[i].md5 === md5) {
        if (this.plugin.app.vault.getAbstractFileByPath(list[i].path)) return list[i].path;
        list.splice(i, 1); // 文件被用户删了: 条目作废
      }
    }
    return null;
  }

  _rememberMd5(md5, path) {
    const il = this.plugin.data.ilink;
    if (!Array.isArray(il.fileMd5s)) il.fileMd5s = [];
    il.fileMd5s.push({ md5, path });
    if (il.fileMd5s.length > 200) il.fileMd5s.splice(0, il.fileMd5s.length - 200);
  }

  // 处理一批非图片媒体(语音兜底/文件/视频), 逐个独立, 一个失败不连累其余
  async _writeOthers(extras, dateStr) {
    if (!extras) return null;
    const parts = [];
    for (const v of extras.voices || []) parts.push(await this._writeVoiceFallback(v, dateStr));
    for (const f of extras.files || []) parts.push(await this._writeFileItem(f, false, dateStr));
    for (const f of extras.videos || []) parts.push(await this._writeFileItem(f, true, dateStr));
    return parts.filter(Boolean).join("\n\n") || null;
  }

  async _writeAllMedia(images, extras, dateStr) {
    const parts = [];
    if (images && images.length) parts.push(await this._writeImages(images, dateStr));
    const others = await this._writeOthers(extras, dateStr);
    if (others) parts.push(others);
    return parts.filter(Boolean).join("\n\n") || null;
  }

  // 纯媒体消息(不带文字)。单模式: 媒体永远照收, 不进文本状态机。
  async _handleMediaOnly(images, extras, cross) {
    const profile = this.profile;
    if (profile.state !== "active") {
      // 头一句就发图/文件: 先收下(内容优先), 再自我介绍
      profile.state = "active";
      const mediaReply = await this._writeAllMedia(images, extras);
      // 开页 tips(撤回/帮助)与欢迎语正文重复, 只留欢迎语里那句
      return (mediaReply ? mediaReply.replace(FIRST_OF_DAY_TIPS, "") + "\n\n" : "") + this._welcome();
    }
    return this._writeAllMedia(images, extras);
  }

  // 主业务路由(v0.3.0 单模式: 发什么记什么, 命令词是唯一例外; 闲聊分支整体退役)
  async _handle(text, isVoice, cross, det) {
    det = det || detectIntent(text);

    if (det.intent === INTENT.HELP) return helpText(this.writer._shared(), this.writer._heading(), _dayStartHour);

    // 探活(在吗/hello/测试…): 回状态, 不落库。用户在 ping"它还在吗"——尊重这个机制,
    // 别把它记进笔记。bot 不在线时本来就没人回, 有回复即是答案。
    if (det.intent === INTENT.CHAT) return pingReply(await this.writer.countDay());

    if (det.intent === INTENT.UNDO) {
      const r = await this.writer.undoLastBlock();
      if (r.foreign) return UNDO_FOREIGN_REPLY; // 独立模式的外来文件护栏(#15 B1): 不是插件建的文件, 不删
      return r.ok ? undoOkReply(r.removed) : UNDO_EMPTY_REPLY;
    }

    if (det.intent === INTENT.FINALIZE) {
      // 封存降级为可选仪式: 写收尾标记, 不再切换任何模式; 之后继续发照样记
      const r = await this.writer.finalizeDay();
      // 用户说过收尾词(哪怕空日子)就记一笔: 说明会用了, 夜间收尾提示见到它永久闭嘴。
      // 同时压掉今天的每日提醒——刚道过晚安, 21:30 再催"今天还没记"就荒唐了(审稿轮抓出)
      if (r.status !== "error") {
        this.profile.finalize_count = (this.profile.finalize_count || 0) + 1;
        this.session.reminded_date = logicalTodayStr();
      }
      // 告别语(晚安/我睡了/今天就到这/明天见)回以同类; 「结束」保留仪式池
      if (det.signoff) return signoffReply(det, r, this.profile.name || null);
      if (r.status === "error") return FINALIZE_FAIL_REPLY;
      if (r.status === "empty") return FINALIZE_EMPTY_REPLY;
      return randomClosing(this.profile.name || null);
    }

    if (det.intent === INTENT.START_DIARY) {
      // 「继续记录」: 告知直接发就行, 不落库(2026-08-19 谷雨实测: 「结束」后第一反应是宣告继续)
      if (det.cont) return CONTINUE_REPLY;
      // 老习惯兼容: 短句只告知"不用了"; 长句(suspect)里是内容, 整句照记不能丢
      if (det.suspect) {
        const writeReply = await this._writeEntry(text, isVoice);
        return writeReply + "\n\n" + START_DIARY_SUSPECT_NOTE;
      }
      const inlineName = extractExplicitName(text); // 「叫我小明, 开始记日记」别丢名字
      if (inlineName) {
        this.profile.name = inlineName;
        this.profile.state = "active";
        return START_DIARY_OBSOLETE_REPLY + "\n\n" + NAME_INLINE_CONFIRM_TEMPLATE.split("{name}").join(inlineName);
      }
      return START_DIARY_OBSOLETE_REPLY;
    }

    // 显式「叫我XX」短句 → 改称呼。只对命令长度的短句生效:
    // 「叫我妈过来吃饭」这类以"叫我"开头的长句是内容, 必须照记(单模式新增的守卫)
    if (!det.forced && codePointLen((text || "").trim()) <= MAX_COMMAND_LEN) {
      const newName = extractExplicitName(text);
      if (newName) {
        this.profile.name = newName;
        this.profile.state = "active";
        return RENAME_CONFIRM_TEMPLATE.split("{name}").join(newName);
      }
    }

    // 默认只剪藏公众号链接；其它网址保持原句记录，除非用户主动打开扩展开关。
    if (!det.forced && !isVoice && this.plugin.settings.webClipEnabled !== false) {
      const links = extractWebUrls(text).filter((url) => shouldClipWebUrl(url, this.plugin.settings));
      if (links.length) return this._clipLinks(text, links);
    }

    // 「记：xx」逃生口: 剥掉前缀, xx 原样落库
    return this._writeEntry(det.forced ? (text || "").trim().replace(FORCE_RECORD_RE, "") : text, isVoice);
  }

  // 首次见面 + 取名"一轮即过"(v0.3.0)。取名永不吞内容:
  // 认得出名字才当名字, 认不出=它是内容, 照记 + 提示称呼可后设; 只问这一轮, 不当拦路虎。
  async _dispatch(text, isVoice, images, extras) {
    const now = new Date();
    const cross = await this._loadOrReset();
    const profile = this.profile;
    const hasText = !!(text || "").trim();
    const extrasCount = extras ? ((extras.voices || []).length + (extras.files || []).length + (extras.videos || []).length) : 0;
    const hasMedia = images.length > 0 || extrasCount > 0;
    const wasActive = profile.state === "active"; // 首次见面/取名轮不挂夜间提示(欢迎语已经够长)
    const det = hasText ? detectIntent(text) : { intent: INTENT.DIARY };
    this._lastWrite = null; // 本轮有没有写成功、写完是否已封存——夜间收尾提示的依据
    this._pendingNudge = null; // 本轮回执带了夜间提示, 等发送成功后由 commitNudge 落账
    this._pendingVoiceAudio = (extras && extras.voiceAudio) || null; // D12: 本条语音的原声(意图是 DIARY 才会用到)

    let reply;
    // 「晚安」+媒体同条: 媒体先落库再收尾, 否则附件掉在封存线下面、回执"3 段都收好了"紧接"第 4 段"自相矛盾
    let imgFirstReply = null;
    if (hasText && hasMedia && det.intent === INTENT.FINALIZE && profile.state === "active") {
      imgFirstReply = await this._writeAllMedia(images, extras);
      images = []; extras = null;
    }
    if (!hasText && hasMedia) {
      reply = await this._handleMediaOnly(images, extras, cross);
    } else if (profile.state !== "active") {
      // 首次见面(D11): 不再问名字, 直接进正题——内容优先记下, 欢迎语跟上
      profile.state = "active";
      if (det.intent === INTENT.DIARY) {
        const writeReply = await this._handle(text, isVoice, cross, det);
        // 开页 tips(撤回/帮助)与欢迎语正文重复, 只留欢迎语里那句
        reply = (writeReply ? writeReply.replace(FIRST_OF_DAY_TIPS, "") + "\n\n" : "") + this._welcome();
      } else {
        reply = this._welcome(); // 第一句是探活/命令: 欢迎语本身就是回答
      }
    } else {
      reply = await this._handle(text, isVoice, cross, det);
    }

    // 图文同条: 微信通常拆成两条发, 但协议允许一条里既有 text 又有媒体。
    // 文字先按原路走完(可能是命令), 媒体永远照收。
    if (hasText && (images.length || extras)) {
      let mediaReply = await this._writeAllMedia(images, extras);
      // 首次见面那条的欢迎语里已有「撤回/帮助」提示, 媒体回执的 tips 不再重复(审稿轮抓出)
      if (mediaReply && !wasActive) mediaReply = mediaReply.replace(FIRST_OF_DAY_TIPS, "");
      if (mediaReply) reply = reply ? reply + "\n\n" + mediaReply : mediaReply;
    }
    if (imgFirstReply) reply = reply ? imgFirstReply + "\n\n" + reply : imgFirstReply;

    // 夜间收尾提示: 当天第一条深夜消息的回执附一句"睡前说声「晚安」"(决策在 nightSignoffTip)。
    // 跨天告知那条不挂(两个括号、"收尾"说两遍), 顺延到今天下一条深夜消息。
    // 计数不在这里落: 回执真发出去了才算说过(见 commitNudge / _handleIncoming), 发不出去不烧额度。
    const willNotice = !!(cross.expiredNotice && !det.signoff);
    if (reply && wasActive && this._lastWrite && !willNotice) {
      const tip = nightSignoffTip({
        n: this._lastWrite.n, sealed: this._lastWrite.sealed, now,
        nudgedDate: this.session.nudged_date, nudgeCount: profile.nudge_count, finalizeCount: profile.finalize_count,
      });
      if (tip) {
        this._pendingNudge = { date: logicalTodayStr(now) };
        // 开页那条已经挂了一个括号(撤回/帮助): 并成一句, 一条回执只挂一个括号
        reply = reply.includes(FIRST_OF_DAY_TIPS) ? reply.replace(FIRST_OF_DAY_TIPS, FIRST_OF_DAY_TIPS_NIGHT) : reply + "\n\n" + tip;
      }
    }

    // 跨天告知: 与「今天第一条」语义重复, 只留前者(告知在前, §3.3); 告别语回执不挂——刚道别就说"翻开新的一页"别扭
    if (reply && cross.expiredNotice && !det.signoff) {
      reply = cross.expiredNotice + "\n\n" + stripFirstPrefix(reply);
    }
    return reply;
  }

  // 入口: 白名单兜底 → 路由 → 离线提示一次性附注
  async onMessage(fromUserId, text, isVoice, images, extras) {
    // 陌生人静默丢弃(_handleIncoming 已挡, 这里兜底): 回复等于向未授权者确认 bot 存活
    if (fromUserId !== this.plugin.data.ilink.userId) return null;
    let reply = await this._dispatch(text, isVoice, images || [], extras || null);
    if (reply && this.offlineNotice) {
      reply = reply + "\n\n" + this.offlineNotice;
      this.offlineNotice = null;
    }
    await this.plugin.persist();
    return reply;
  }

  // 回执真送达了才把夜间提示记账(一天一次 + 终身 3 次)。返回是否落了账(调用方据此 persist)。
  commitNudge() {
    const pn = this._pendingNudge;
    if (!pn) return false;
    this._pendingNudge = null;
    this.session.nudged_date = pn.date;
    this.profile.nudge_count = (this.profile.nudge_count || 0) + 1;
    return true;
  }
}

// ── 扫码绑定 Modal ───────────────────────────────────────────────────────

class QrLoginModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.aborted = false;
    this.verifyCode = null;
    this.verifyResolve = null;
  }

  onOpen() {
    this.plugin._activeQrModal = this; // 插件卸载时要能关掉这个弹窗
    this.titleEl.setText("扫码绑定微信");
    const c = this.contentEl;
    c.addClass("wechat-diary-qr-modal");
    this.statusEl = c.createEl("p", { text: "正在获取二维码…", cls: "wechat-diary-qr-status" });
    this.imgWrap = c.createDiv({ cls: "wechat-diary-qr-imgwrap" });
    this.verifyWrap = c.createDiv({ cls: "wechat-diary-qr-verify" });
    this.verifyWrap.hide();
    c.createEl("p", {
      cls: "wechat-diary-qr-hint",
      text: "用手机微信扫码, 在打开的页面里确认绑定。二维码过期会自动刷新。",
    });
    this._run();
  }

  onClose() {
    this.aborted = true;
    if (this.verifyResolve) { this.verifyResolve(null); this.verifyResolve = null; }
    // 立刻掐断在途轮询, 不等 35s 超时后才走到 _run 的 finally
    if (this._client) { this._client.destroyAll(); this._client = null; }
    if (this.plugin._activeQrModal === this) this.plugin._activeQrModal = null;
    this.contentEl.empty();
  }

  _setStatus(text) { if (!this.aborted) this.statusEl.setText(text); }

  _renderQr(pageUrl) {
    this.imgWrap.empty();
    try {
      const qr = qrcode(0, "M");
      qr.addData(pageUrl);
      qr.make();
      const dataUrl = qr.createDataURL(6, 8);
      this.imgWrap.createEl("img", { cls: "wechat-diary-qr-img", attr: { src: dataUrl, alt: "微信扫码" } });
    } catch (e) {
      // 编码失败兜底: 给官方二维码页面链接
      this.imgWrap.createEl("a", { text: "打开官方二维码页面", attr: { href: pageUrl, target: "_blank" } });
    }
  }

  _askVerifyCode() {
    this.verifyWrap.show();
    this.verifyWrap.empty();
    this.verifyWrap.createEl("p", { text: "微信提示需要验证: 输入手机微信上显示的数字" });
    let inputEl;
    new Setting(this.verifyWrap)
      .addText((t) => { inputEl = t.inputEl; t.setPlaceholder("验证码"); })
      .addButton((b) => b.setButtonText("提交").setCta().onClick(() => {
        const v = (inputEl.value || "").trim();
        if (v && this.verifyResolve) { this.verifyWrap.hide(); this.verifyResolve(v); this.verifyResolve = null; }
      }));
    return new Promise((resolve) => { this.verifyResolve = resolve; });
  }

  async _run() {
    const plugin = this.plugin;
    let client;
    try {
      client = new ILinkClient();
    } catch (e) {
      this._setStatus(String(e && e.message));
      return;
    }
    this._client = client;
    const startTs = Date.now();
    let refreshes = 0;
    let verifyCode = null;
    try {
      const oldToken = plugin.getBotToken();
      let { qrcode: ticket, qrPageUrl } = await client.getQrcode(oldToken ? [oldToken] : []);
      this._renderQr(qrPageUrl);
      this._setStatus("等待扫码…");
      let pollBase = FIXED_BASE_URL;
      let qrIssuedAt = Date.now();
      const refreshQr = async (statusText) => {
        refreshes += 1;
        if (refreshes > 3) return false;
        const fresh = await client.getQrcode(plugin.getBotToken() ? [plugin.getBotToken()] : []);
        ticket = fresh.qrcode;
        verifyCode = null; // 新码不携带旧验证码
        qrIssuedAt = Date.now();
        this._renderQr(fresh.qrPageUrl);
        this._setStatus(statusText);
        return true;
      };

      while (!this.aborted) {
        if (Date.now() - startTs > LOGIN_TOTAL_TIMEOUT_MS) { this._setStatus("登录超时了, 关掉重试一次吧"); return; }
        if (Date.now() - qrIssuedAt > QR_LOCAL_TTL_MS) {
          try {
            if (!(await refreshQr("二维码刷新了, 重新扫一下~"))) { this._setStatus("二维码多次失效, 稍后再试吧"); return; }
          } catch (e) {
            await sleepMs(2000); // 主动换码撞上网络抖动: 重试, 别把登录整个判死(refreshes 计数天然封顶)
          }
          continue;
        }
        let r;
        try {
          r = await client.pollQrStatus(pollBase, ticket, verifyCode);
        } catch (e) {
          await sleepMs(1000); // 网关抖动(5xx/524 等)视为 wait
          continue;
        }
        if (r.__timeout) continue; // 长轮询正常心跳
        const st = r.json && r.json.status;

        if (st === "confirmed") {
          const j = r.json;
          if (!j.ilink_bot_id) { this._setStatus("登录响应缺 bot_id, 换个姿势再试一次?"); return; }
          await plugin.onLoginConfirmed({
            botToken: j.bot_token, botId: j.ilink_bot_id,
            userId: j.ilink_user_id, baseUrl: (j.baseurl || "").trim(),
          });
          new Notice("微信绑定成功 📖");
          this.close();
          return;
        }
        if (st === "binded_redirect") {
          // 官方语义是【成功】, 不是失败 —— login-qr.ts:162-168 原文: "the scanned bot is
          // already bound to this OpenClaw instance, so no new credentials are issued and
          // existing local credentials remain valid. Callers should treat this as a
          // successful outcome". v0.2.1 之前这里在缺 userId 时误报成"已绑定到别处",
          // 把本来能救的半绑定判成了死局。
          if (plugin.getBotToken()) {
            const uid = (r.json && r.json.ilink_user_id) || "";
            if (uid && !plugin.data.ilink.userId) await plugin.adoptOwner(uid);
            if (plugin.data.ilink.userId) {
              new Notice("这个 bot 已经连过了, 沿用现有登录");
            } else {
              // 服务端这一路不保证下发 ilink_user_id; 拿不到就交给管道认领
              new Notice("这个 bot 已经连过了。给它发条消息, 就能把你认回来");
              plugin.startPipeline();
            }
            this.close();
          } else {
            // 没有 token 又被判已连接: 本机凭据确实没了, 服务端不补发, 本地无解
            this._setStatus("这个微信号已经连过一个 bot, 但本机凭据已丢失, 服务端不会补发。换个微信号扫可以立刻用上。");
          }
          return;
        }
        if (st === "expired") {
          if (!(await refreshQr("二维码刷新了, 重新扫一下~"))) { this._setStatus("二维码多次失效, 稍后再试吧"); return; }
          continue;
        }
        if (st === "scaned_but_redirect") {
          if (r.json.redirect_host) pollBase = "https://" + r.json.redirect_host;
          continue;
        }
        if (st === "need_verifycode") {
          if (verifyCode) this._setStatus("验证码不对, 再输一次");
          else this._setStatus("需要输入验证码");
          verifyCode = await this._askVerifyCode();
          if (this.aborted || !verifyCode) return;
          continue; // 提交验证码后立即轮询, 不 sleep
        }
        if (st === "verify_code_blocked") {
          verifyCode = null;
          if (!(await refreshQr("验证码多次输错, 换了张新码, 重新扫"))) { this._setStatus("验证码多次输错被暂时限制, 过一会儿再试"); return; }
          continue;
        }
        if (st === "scaned") { verifyCode = null; this._setStatus("已扫码, 在手机上确认一下…"); } // 走到 scaned 说明验证码已通过, 清暂存(同官方)
        // wait 及未知状态(官方枚举外): 继续轮询
        await sleepMs(1000);
      }
    } catch (e) {
      console.error("[wechat-diary] 登录失败:", e);
      this._setStatus("登录出错: " + String(e && e.message));
    } finally {
      client.destroyAll();
    }
  }
}

function sleepMs(ms) { return new Promise((r) => window.setTimeout(r, ms)); }

// onConfirm(keepToken): true = 只清主人身份、留着凭据(认错人了用这个);
// false = 连凭据一起清。分两个按钮是因为清凭据可能不可逆 —— 服务端不补发凭据,
// 一旦这个微信号在服务端还记着一条连接, 清掉本机 token 就再也扫不回来了。
class ConfirmUnbindModal extends Modal {
  constructor(app, state, onConfirm) { super(app); this.state = state; this.onConfirm = onConfirm; }
  onOpen() {
    const half = this.state === "half";
    this.titleEl.setText(half ? "清除本机残留凭据?" : "解除微信绑定?");
    this.contentEl.createEl("p", { text: "日记文件不受影响, 只动本机的登录状态。" });
    this.contentEl.createEl("p", {
      text: half
        ? "⚠️ 本机还留着微信登录凭据。清掉之后, 如果服务端仍记着这个微信号已经连过一个 bot, 扫码会拿不回新凭据 —— 那就只能换个微信号扫了。想恢复原来那个, 先给 bot 发条消息认领, 别点这里。"
        : "⚠️ 「彻底解除」会一起清掉微信登录凭据。服务端不补发凭据, 之后用同一个微信号重扫可能会被判成「已连接过」而拿不到新凭据。只是想换个主人的话, 用左边那个。",
    });
    const s = new Setting(this.contentEl);
    if (!half) {
      s.addButton((b) => b.setButtonText("只清主人身份").onClick(() => { this.close(); this.onConfirm(true); }));
    }
    s.addButton((b) => b.setButtonText(half ? "清除凭据" : "彻底解除").setWarning().onClick(() => { this.close(); this.onConfirm(false); }))
      .addButton((b) => b.setButtonText("先不了").onClick(() => this.close()));
  }
  onClose() { this.contentEl.empty(); }
}

// 待认领确认。协议层没有 allowlist(陌生人可直达 bot), 所以认主人这一步必须由人点头,
// 不能"谁先发消息谁是主人"。关掉窗口 = 不认, 下一条消息会再问一次。
class ClaimOwnerModal extends Modal {
  constructor(app, userId, onDone) { super(app); this.userId = userId; this.onDone = onDone; this._answered = false; }
  onOpen() {
    this.titleEl.setText("是你在给 bot 发消息吗?");
    this.contentEl.createEl("p", { text: "本机还留着微信登录凭据, 但不知道主人是谁了(重装插件或换设备会这样)。" });
    this.contentEl.createEl("p", { text: "刚刚有个微信用户给这个 bot 发了消息: " + String(this.userId).slice(0, 18) + "…" });
    this.contentEl.createEl("p", { text: "确认是你本人, 才会开始把消息写进日记。不是的话直接关掉。" });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("是我, 恢复记录").setCta().onClick(() => { this._answered = true; this.close(); this.onDone(true, true); }))
      .addButton((b) => b.setButtonText("不是").onClick(() => { this._answered = true; this.close(); this.onDone(false, true); }));
  }
  onClose() {
    this.contentEl.empty();
    // 叉掉/Esc 也要放开 _claiming, 否则再没人问了。但这不算"明确否认",
    // 不拉黑这个 id —— 误触 Esc 不该让人整个会话都认不回来。
    if (!this._answered) this.onDone(false, false);
  }
}

// ── 设置页 ───────────────────────────────────────────────────────────────

// 通用确认框(#15 设置页用): 标题 + 正文 + 确定/取消
class ConfirmModal extends Modal {
  constructor(app, title, text, okText, onOk, onCancel) {
    super(app); this.t = title; this.text = text; this.okText = okText; this.onOk = onOk; this.onCancel = onCancel || null; this._done = false;
  }
  onOpen() {
    this.titleEl.setText(this.t);
    const pEl = this.contentEl.createEl("p", { text: this.text });
    if (pEl && pEl.style) pEl.style.whiteSpace = "pre-wrap";
    const row = new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(this.okText).setCta().onClick(async () => { this._done = true; this.close(); await this.onOk(); }));
    if (!this.hideCancel) row.addButton((b) => b.setButtonText("取消").onClick(() => this.close()));
  }
  onClose() { this.contentEl.empty(); if (!this._done && this.onCancel) this.onCancel(); }
}

class WechatDiarySettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  // ── #15 设置页辅助 ──
  // 外来文件提示(B1): 开关关着、路径却指向不是插件建的文件(多半是用户的每日笔记) → 确认框 + 「改回默认」
  async _foreignCheck() {
    const plugin = this.plugin;
    if (plugin.settings.sharedDailyNote) return;
    const path = plugin.writer.diaryPath(logicalTodayStr());
    const f = plugin.app.vault.getFileByPath(path);
    if (!f) return;
    let content = "";
    try { content = await plugin.app.vault.cachedRead(f); } catch (e) { return; }
    if (!isForeignFile(content)) return;
    // 文件里有我们的节 = 共用模式自己写的每日笔记, 不是外来文件——不能提供「改回默认」
    // (谷雨实测: 关开关时点了改回默认, 路径格式被改掉, 之后的文件散在两个层级)
    const loc = locateSection(content, plugin.writer._heading());
    if (loc) {
      const m = new ConfirmModal(this.app, "已关闭「写进已有的每日笔记」",
        "今天的文件「" + path + "」是共用模式写的每日笔记。关掉后, 微信内容会继续追加到这个文件的末尾(不再归入「" + plugin.writer._heading() + "」一节), 「撤回」「在吗」只认微信记的部分。\n想让内容写回插件自己的文件夹, 改「日记」区的 日记文件夹 / 路径格式。",
        "知道了", async () => {});
      m.hideCancel = true;
      m.open();
      return;
    }
    const before = plugin._beforeImport;
    const target = before
      ? { diaryFolder: before.diaryFolder, pathFormat: before.pathFormat }
      : { diaryFolder: DEFAULT_SETTINGS.diaryFolder, pathFormat: DEFAULT_SETTINGS.pathFormat };
    const changes = [];
    if ((plugin.settings.diaryFolder || "日记") !== (target.diaryFolder || "日记")) changes.push("日记文件夹「" + (plugin.settings.diaryFolder || "日记") + "」→「" + (target.diaryFolder || "日记") + "」");
    if ((plugin.settings.pathFormat || DEFAULT_SETTINGS.pathFormat) !== (target.pathFormat || DEFAULT_SETTINGS.pathFormat)) changes.push("路径格式「" + (plugin.settings.pathFormat || DEFAULT_SETTINGS.pathFormat) + "」→「" + (target.pathFormat || DEFAULT_SETTINGS.pathFormat) + "」");
    if (!changes.length) return;
    new ConfirmModal(this.app, "路径指向的不是插件建的文件",
      "「" + path + "」不是插件建的(多半是你的每日笔记)。开关关着时插件会往里追加内容, 但只数、只撤微信记的那部分。\n要改回" + (before ? "导入前的路径" : "默认路径") + "吗? 会改: " + changes.join("; "),
      before ? "改回导入前" : "改回默认",
      async () => {
        if (before) { plugin.settings.diaryFolder = before.diaryFolder; plugin.settings.pathFormat = before.pathFormat; plugin.settings.templatePath = before.templatePath; }
        else { plugin.settings.diaryFolder = DEFAULT_SETTINGS.diaryFolder; plugin.settings.pathFormat = DEFAULT_SETTINGS.pathFormat; }
        plugin._beforeImport = null;
        await plugin.persist();
        this.display();
      }).open();
  }

  // 节标题撞用户模板里已有的标题: 今天的文件里该标题下已有内容 → 确认; 取消则回退(onCancel 由调用方给)
  async _headingCollisionCheck(onCancel) {
    const plugin = this.plugin;
    if (!plugin.settings.sharedDailyNote) return;
    const w = plugin.writer;
    const f = plugin.app.vault.getFileByPath(w.diaryPath(logicalTodayStr()));
    if (!f) return;
    let content = "";
    try { content = await plugin.app.vault.cachedRead(f); } catch (e) { return; }
    const heading = w._heading();
    const loc = locateSection(content, heading);
    if (!loc || !trimBody(normalizeNewlines(content.slice(loc.bodyStart, loc.bodyEnd))).trim()) return;
    new ConfirmModal(this.app, "这个标题下面已经有内容",
      "今天的每日笔记里「" + heading + "」下面已经有内容。插件会把它当成自己的一节: 计入段数, 「撤回」会删到它。\n确定用这个标题吗?",
      "确定", async () => {}, onCancel).open();
  }

  // 读每日笔记的设置: Periodic Notes(daily) 优先, 否则核心「每日笔记」。返回 { src: {folder,format,template}, name } 或 null
  _readDailyNotesSettings() {
    const app = this.app;
    try {
      const pn = app.plugins && app.plugins.getPlugin ? app.plugins.getPlugin("periodic-notes") : null;
      if (pn && pn.settings && pn.settings.daily && pn.settings.daily.enabled !== false) return { src: pn.settings.daily, name: "Periodic Notes" };
      const dn = app.internalPlugins && app.internalPlugins.getPluginById ? app.internalPlugins.getPluginById("daily-notes") : null;
      if (dn && dn.enabled && dn.instance && dn.instance.options) return { src: dn.instance.options, name: "每日笔记" };
    } catch (e) { /* 读不到按没有算 */ }
    return null;
  }

  // 打开开关时自动对齐(谷雨 8/31 拍板做法一): 每日笔记的位置/格式与插件设置不一致 → 直接弹导入确认;
  // 读不到设置 → 提示自己选。不静默改任何值。
  async _suggestImportOnEnable() {
    const plugin = this.plugin;
    const found = this._readDailyNotesSettings();
    if (!found) {
      new Notice("没找到每日笔记插件的设置(核心「每日笔记」或 Periodic Notes 都没启用)。请在「日记」区选好你每日笔记的文件夹和路径格式, 否则微信内容会写到「" + (plugin.settings.diaryFolder || "日记") + "」下、和你的每日笔记不在一起", 12000);
      return;
    }
    const dnFolder = String(found.src.folder || "").trim() || "/";
    const dnFormat = String(found.src.format || "").trim() || "YYYY-MM-DD";
    const curFolder = String(plugin.settings.diaryFolder || "日记");
    const curFormat = plugin.settings.pathFormat || DEFAULT_SETTINGS.pathFormat;
    const same = normalizePath(dnFolder === "/" ? "/" : dnFolder) === normalizePath(curFolder === "/" ? "/" : curFolder) && dnFormat === curFormat;
    if (same) return;
    this._importDailyNotes(); // 已自带差异清单 + 确认框
  }

  // 从每日笔记设置导入: 一键覆盖三项, 先确认
  _importDailyNotes() {
    const plugin = this.plugin;
    const app = this.app;
    const found = this._readDailyNotesSettings();
    const src = found && found.src, name = found && found.name;
    if (!src) { new Notice("没找到启用的每日笔记设置(核心「每日笔记」或 Periodic Notes 的 daily), 请在上面自己选日记文件夹 / 路径格式 / 模板"); return; }
    const folder = String(src.folder || "").trim() || "/";
    const format = String(src.format || "").trim() || "YYYY-MM-DD";
    const tplRaw = String(src.template || "").trim();
    let tplPath = "";
    if (tplRaw) {
      const mc = app.metadataCache;
      const f = mc && typeof mc.getFirstLinkpathDest === "function" ? mc.getFirstLinkpathDest(normalizePath(tplRaw), "") : null;
      if (f && f.path) tplPath = f.path;
      else if (app.vault.getFileByPath(normalizePath(tplRaw + ".md"))) tplPath = normalizePath(tplRaw + ".md");
      else if (app.vault.getFileByPath(normalizePath(tplRaw))) tplPath = normalizePath(tplRaw);
    }
    const v = validatePathFormat(format, { requireDaily: true, momentLib: moment });
    const cur = plugin.settings;
    const text = "将把下面三项覆盖为" + name + "的设置:\n" +
      "· 日记文件夹: " + folder + (folder === "/" ? " (库根目录)" : "") + "\n" +
      "· 路径格式: " + format + (v.ok ? "" : " (⚠️ " + v.error + ", 这项不会导入)") + "\n" +
      "· 模板: " + (tplPath || (tplRaw ? "没找到「" + tplRaw + "」, 请自己选" : "无")) + "\n\n" +
      "当前值: 日记文件夹「" + (cur.diaryFolder || "日记") + "」, 路径格式「" + (cur.pathFormat || DEFAULT_SETTINGS.pathFormat) + "」, 模板「" + (cur.templatePath || "无") + "」";
    new ConfirmModal(this.app, "从" + name + "设置导入", text, "导入", async () => {
      plugin._beforeImport = { diaryFolder: cur.diaryFolder, pathFormat: cur.pathFormat, templatePath: cur.templatePath };
      cur.diaryFolder = folder;
      if (v.ok) cur.pathFormat = v.value; else new Notice("路径格式没导入: " + v.error);
      cur.templatePath = tplPath;
      if (tplRaw && !tplPath) new Notice("模板文件没找到, 请自己选");
      await plugin.persist();
      this.display();
    }).open();
  }

  // 选文件夹/文件(谷雨 8/30 终审: 不让用户填, 也不要级联下拉): 一个输入框, 点进去就弹出整棵树(按层级缩进),
  // 打字过滤, 点一项才选定; 手打一个不存在的路径在离开输入框时回退并提示"先在文件列表里建好"。
  // 与 Obsidian 核心「附件默认存放路径」「每日笔记 → 新建文件位置」同一种交互。
  _pathSuggest(t, opts) {
    const app = this.app;
    const kind = opts.kind || "folder";
    let saved = opts.value || "";
    let typed = false;
    const isFolder = (c) => c && Array.isArray(c.children);
    const allItems = () => {
      let list = [];
      try {
        if (kind === "folder") {
          const folders = typeof app.vault.getAllFolders === "function"
            ? app.vault.getAllFolders()
            : app.vault.getAllLoadedFiles().filter(isFolder);
          list = folders.map((f) => f.path).filter((x) => x && x !== "/");
        } else {
          list = (typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : []).map((f) => f.path);
        }
      } catch (e) { list = []; }
      list.sort((a, b) => a.localeCompare(b));
      if (kind === "folder" && opts.allowRoot) list.unshift("/");
      return list;
    };
    const commit = async (v) => {
      if (v === saved) return;
      saved = v;
      t.setValue(v);
      await opts.onPick(v);
    };
    t.setValue(saved);
    t.inputEl.addEventListener("input", () => { typed = true; });
    if (typeof AbstractInputSuggest === "function") {
      const sug = new (class extends AbstractInputSuggest {
        getSuggestions(query) {
          const all = allItems();
          const q = (query || "").trim().toLowerCase();
          // 刚点进来(没打字)或框里就是当前值: 列整棵树, 让人用眼睛找、用鼠标点
          if (!typed || !q || q === String(saved).toLowerCase()) return all.slice(0, 300);
          return all.filter((x) => x.toLowerCase().includes(q)).slice(0, 300);
        }
        renderSuggestion(item, el) {
          if (item === "/") { el.setText("库根目录 /"); return; }
          const depth = item.split("/").length - 1;
          const name = item.split("/").pop();
          el.setText((kind === "folder" ? "📁 " : "📄 ") + name);
          if (el.style) el.style.paddingLeft = (12 + depth * 16) + "px";
          if (depth > 0 && el.setAttr) el.setAttr("title", item);
        }
        selectSuggestion(item) { typed = false; this.close(); commit(item); }
      })(app, t.inputEl);
      t.inputEl.addEventListener("focus", () => { typed = false; try { sug.open(); } catch (e) { /* 老版本没有 open, 打一个字也会弹 */ } });
    }
    // 离开输入框: 手打的路径必须是库里已有的(或 "/"), 否则回退
    t.inputEl.addEventListener("blur", () => {
      window.setTimeout(async () => {
        const v = (t.getValue() || "").trim();
        if (!v) { t.setValue(saved); return; }
        if (v === saved) return;
        const ok = (kind === "folder" && opts.allowRoot && v === "/") || allItems().includes(normalizePath(v));
        if (ok) await commit(v === "/" ? "/" : normalizePath(v));
        else { t.setValue(saved); new Notice(kind === "folder" ? "库里没有这个文件夹, 先在 Obsidian 文件列表里建好再来选" : "库里没有这个文件, 请从列表里选"); }
      }, 150); // 让点选列表项的 selectSuggestion 先跑
    });
  }

  // 输入框下方的实时预览行(B3): 合法显示"今天会写到: …", 不合法变红写原因; 不弹 Notice
  _previewLine(setting, render) {
    const host = setting.descEl || setting.settingEl || setting.controlEl;
    const el = host && host.createDiv ? host.createDiv({ cls: "wd-path-preview" }) : null;
    const update = () => {
      if (!el) return;
      const r = render();
      el.setText(r.text);
      if (el.toggleClass) el.toggleClass("wd-path-preview-bad", !r.ok);
    };
    update();
    return update;
  }

  // 去抖定时器统一登记: 重绘(display)前先把没到点的提交一次, 免得"页面显示旧值、data.json 已是新值"
  _later(fn, ms) {
    if (!this._timers) this._timers = new Map();
    const id = window.setTimeout(async () => { this._timers.delete(id); try { await fn(); } catch (e) { console.error("[wechat-diary] 设置页提交失败:", e && e.message); } }, ms);
    this._timers.set(id, fn);
    return id;
  }
  _clearLater(id) { if (this._timers && this._timers.has(id)) { window.clearTimeout(id); this._timers.delete(id); } }
  async _flushLater() {
    if (!this._timers || !this._timers.size) return;
    const fns = [...this._timers.values()];
    for (const id of this._timers.keys()) window.clearTimeout(id);
    this._timers.clear();
    for (const fn of fns) { try { await fn(); } catch (e) { console.error("[wechat-diary] 设置页提交失败:", e && e.message); } }
  }

  display() {
    const { containerEl } = this;
    if (this._timers && this._timers.size) { this._flushLater().then(() => this.display()); return; }
    containerEl.empty();
    const plugin = this.plugin;

    new Setting(containerEl).setName("微信").setHeading();

    const state = plugin.bindState();
    const bindDesc = state === "bound"
      ? "已绑定 (" + String(plugin.data.ilink.userId).slice(0, 18) + "…)。消息管道在 Obsidian 打开期间运行。"
      : state === "half"
        ? "待认领: 本机凭据还在, 但主人身份丢了(重装插件或换设备会这样)。给微信 bot 发条消息, 这里会弹确认。"
        : "未绑定。扫码后, 对微信 bot 说话就能写进库里。";
    new Setting(containerEl)
      .setName("绑定状态")
      .setDesc(bindDesc)
      .addButton((b) => b.setButtonText(state === "none" ? "扫码绑定" : "重新扫码").setCta()
        .onClick(() => new QrLoginModal(this.app, plugin).open()))
      .addButton((b) => {
        b.setButtonText(state === "half" ? "清除残留凭据" : "解除绑定").onClick(() => {
          new ConfirmUnbindModal(this.app, state, async (keepToken) => {
            await plugin.unbind(keepToken);
            this.display();
          }).open();
        });
        // 只要还有任何一半残留就必须能清 —— 这个按钮在半绑定时被禁用, 正是 v0.2.1
        // 之前用户被锁死的直接原因: 清不掉残留 token, 重新扫码就永远被顶回来。
        if (state === "none") b.setDisabled(true);
      });

    // ── 日记 ──────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("日记").setHeading();
    const st = plugin.settings;
    const todayD = logicalTodayStr();
    let fmtPreview = null; // 路径格式的预览行(下面声明); 改日记文件夹时也要刷新它

    new Setting(containerEl)
      .setName("日记文件夹")
      .setDesc("日记的根目录。点进去选一个库里的文件夹(打字可以过滤)。文件放在根目录下的哪里由下面的「日记文件路径格式」决定。要用新文件夹, 先在 Obsidian 文件列表里建好再来选。")
      .addText((t) => this._pathSuggest(t, {
        kind: "folder", allowRoot: true, value: st.diaryFolder || "日记",
        onPick: async (v) => { st.diaryFolder = v || "日记"; await plugin.persist(); if (fmtPreview) fmtPreview(); await this._foreignCheck(); },
      }));

    // 路径格式: 三个预设 + 自定义(选了自定义才露出输入框)
    const PRESETS = {
      "YYYY/YYYY-MM-DD": "按年分文件夹 (2026/2026-08-30.md)",
      "YYYY/MM/YYYY-MM-DD": "按年/月分文件夹 (2026/08/2026-08-30.md)",
      "YYYY-MM-DD": "不分文件夹 (2026-08-30.md)",
    };
    const curFmt = st.pathFormat || DEFAULT_SETTINGS.pathFormat;
    const fmtIsPreset = Object.prototype.hasOwnProperty.call(PRESETS, curFmt);
    let fmtDraft = curFmt;
    let fmtTimer = null;
    const fmtSetting = new Setting(containerEl)
      .setName("日记文件路径格式")
      .setDesc("改了之后已有文件不搬, 只影响之后新建的。");
    fmtPreview = this._previewLine(fmtSetting, () => {
      const v = validatePathFormat(fmtDraft, { requireDaily: true, momentLib: moment });
      if (!v.ok) return { ok: false, text: v.error + " (没有保存)" };
      return { ok: true, text: "今天会写到: " + plugin.writer._join(plugin.writer._root(), renderPath(v.value, todayD, moment) + ".md") };
    });
    fmtSetting.addDropdown((d) => {
      const opts = Object.assign({}, PRESETS, { custom: "自定义…" });
      d.addOptions(opts).setValue(fmtIsPreset ? curFmt : "custom")
        .onChange(async (v) => {
          if (v === "custom") { st._fmtCustom = true; this.display(); return; }
          st._fmtCustom = false;
          if (v !== st.pathFormat) { st.pathFormat = v; await plugin.persist(); await this._foreignCheck(); }
          fmtDraft = v;
          this.display();
        });
    });
    if (!fmtIsPreset || st._fmtCustom) {
      const customSetting = new Setting(containerEl)
        .setName("自定义路径格式")
        .setDesc("相对日记文件夹; 与 Obsidian 每日笔记「日期格式」同一套写法(moment)。英文字母会被当成日期代码, 固定的文件夹名要放在方括号里, 如 [daily]/YYYY/MM/YYYY-MM-DD。");
      customSetting.addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.pathFormat).setValue(fmtIsPreset ? "" : curFmt)
        .onChange((v) => {
          fmtDraft = (v || "").trim() || DEFAULT_SETTINGS.pathFormat;
          this._clearLater(fmtTimer);
          fmtTimer = this._later(async () => {
            const r = validatePathFormat(fmtDraft, { requireDaily: true, momentLib: moment });
            if (r.ok && r.value !== st.pathFormat) { st.pathFormat = r.value; await plugin.persist(); await this._foreignCheck(); }
            fmtPreview();
          }, 400);
        }));
    }

    new Setting(containerEl).setName("链接剪藏").setHeading();
    new Setting(containerEl)
      .setName("自动提取公众号正文")
      .setDesc("微信里发 mp.weixin.qq.com 公众号链接时，抓取标题、正文和正文图片保存为 Markdown；今日日记保留原句并另起一行放剪藏入口。")
      .addToggle((t) => t.setValue(plugin.settings.webClipEnabled !== false)
        .onChange(async (v) => { plugin.settings.webClipEnabled = v; await plugin.persist(); }));
    new Setting(containerEl)
      .setName("其他网站的链接也提取正文")
      .setDesc("默认关闭。关闭时普通网址只按原句记进日记，不访问网页；开启后才尝试剪藏其它公开网站。")
      .addToggle((t) => t.setValue(plugin.settings.webClipOtherSites === true)
        .onChange(async (v) => { plugin.settings.webClipOtherSites = v; await plugin.persist(); }));
    const defaultClipFolder = defaultWebClipFolder(plugin.settings);
    new Setting(containerEl)
      .setName("剪藏文件夹")
      .setDesc("默认跟随日记文件夹，放在 <日记文件夹>/剪藏；留空即可恢复跟随")
      .addText((t) => t.setPlaceholder(defaultClipFolder).setValue(plugin.settings.webClipFolder || defaultClipFolder)
        .onChange(async (v) => { plugin.settings.webClipFolder = (v || "").trim(); await plugin.persist(); }));
    new Setting(containerEl)
      .setName("保存正文图片")
      .setDesc("下载正文区域内的图片到剪藏文件夹 assets 目录，并在 Markdown 中使用本地 Obsidian 图片内链。单张图片上限 15MB。")
      .addToggle((t) => t.setValue(plugin.settings.webClipSaveImages !== false)
        .onChange(async (v) => { plugin.settings.webClipSaveImages = v; await plugin.persist(); }));
    new Setting(containerEl)
      .setName("每篇最多图片数")
      .setDesc("范围 1–100，默认 30；超出的图片会保留原图链接和失败原因")
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "1";
        t.inputEl.max = String(WEB_CLIP_HARD_MAX_IMAGES);
        t.setValue(String(webClipMaxImages(plugin.settings))).onChange(async (v) => {
          const n = Math.floor(Number(v));
          if (!Number.isFinite(n) || n < 1 || n > WEB_CLIP_HARD_MAX_IMAGES) return;
          plugin.settings.webClipMaxImages = n;
          await plugin.persist();
        });
      });
    new Setting(containerEl)
      .setName("每篇图片总量上限（MB）")
      .setDesc("范围 15–500，默认 50；包含大量动图的文章会占用更多 Vault 空间")
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = String(WEB_CLIP_MIN_TOTAL_IMAGE_MB);
        t.inputEl.max = String(WEB_CLIP_HARD_MAX_TOTAL_IMAGE_MB);
        t.setValue(String(Math.floor(webClipMaxTotalImageBytes(plugin.settings) / 1024 / 1024))).onChange(async (v) => {
          const n = Math.floor(Number(v));
          if (!Number.isFinite(n) || n < WEB_CLIP_MIN_TOTAL_IMAGE_MB || n > WEB_CLIP_HARD_MAX_TOTAL_IMAGE_MB) return;
          plugin.settings.webClipMaxTotalImageMb = n;
          await plugin.persist();
        });
      });

    // 时区: 引擎支持就给完整 IANA 下拉, 不支持退回文本框
    const curTz = plugin.settings.timezone || "Asia/Shanghai";
    let tzList = [];
    try { tzList = Intl.supportedValuesOf("timeZone"); } catch (e) { /* 老引擎 */ }
    const tzSetting = new Setting(containerEl)
      .setName("时区")
      .setDesc("日记文件名和时间戳所用时区, 默认北京时间");
    if (tzList.length) {
      const tzOptions = {};
      if (!tzList.includes(curTz)) tzOptions[curTz] = curTz;
      for (const z of tzList) tzOptions[z] = z;
      tzSetting.addDropdown((d) => d.addOptions(tzOptions).setValue(curTz)
        .onChange(async (v) => {
          plugin.settings.timezone = v;
          setTimezone(v);
          await plugin.persist();
        }));
    } else {
      tzSetting.addText((t) => t.setPlaceholder("Asia/Shanghai").setValue(curTz)
        .onChange(async (v) => {
          plugin.settings.timezone = v.trim() || "Asia/Shanghai";
          setTimezone(plugin.settings.timezone);
          await plugin.persist();
        }));
    }

    // ── 写进已有的每日笔记 ────────────────────────────────────────────────
    new Setting(containerEl).setName("写进已有的每日笔记").setHeading();
    const headingNow = st.sectionHeading || DEFAULT_SETTINGS.sectionHeading;
    new Setting(containerEl)
      .setName("写进已有的每日笔记")
      .setDesc("开启后不再单独建文件: 微信内容写进当天每日笔记末尾的「## " + headingNow + "」一节, 撤回和段数只看这一节。打开时会读取每日笔记插件的位置并请你确认对齐; 之后你改了每日笔记插件的设置, 这里不会自动跟着变(看下面的预览行)。关着时一切与以前相同。")
      .addToggle((t) => t.setValue(!!st.sharedDailyNote)
        .onChange(async (v) => {
          st.sharedDailyNote = v;
          await plugin.persist();
          if (v) {
            await this._suggestImportOnEnable(); // 位置/格式和每日笔记插件不一致 → 弹导入确认(做法一, 8/31)
            await this._headingCollisionCheck(async () => { st.sharedDailyNote = false; await plugin.persist(); this.display(); });
          } else await this._foreignCheck();
          this.display();
        }));
    if (st.sharedDailyNote) {
      let headingTimer = null;
      new Setting(containerEl)
        .setName("节标题")
        .setDesc("级别固定二级(## 标题)。这一节归插件: 节下面写任何标题就算节结束; 节里手写的内容会被当成插件的; 别用你每日笔记里已有的标题。改标题只影响之后, 已写的留在旧标题下。想固定这一节的位置, 把「## " + headingNow + "」写进你的每日笔记模板, 标题下面留空。当天切换开关, 今天已记的段落不跟着走。")
        .addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.sectionHeading).setValue(headingNow)
          .onChange((v) => {
            this._clearLater(headingTimer);
            headingTimer = this._later(async () => {
              const r = normalizeHeading(v);
              if (!r.value) return; // 空/半截: 不落盘
              if (r.error) { new Notice(r.error); return; }
              if (r.stripped) { new Notice("节标题固定二级, 已去掉 #"); t.setValue(r.value); }
              if (r.value === st.sectionHeading) return;
              const old = st.sectionHeading;
              st.sectionHeading = r.value;
              await plugin.persist();
              await this._headingCollisionCheck(async () => { st.sectionHeading = old; await plugin.persist(); this.display(); });
            }, 500);
          }));
      const tplSetting = new Setting(containerEl)
        .setName("新建文件时用的模板")
        .setDesc("当天的每日笔记还不存在时(微信先到), 按这个模板建文件再写入我们那一节——否则每日笔记插件之后打开就不套模板了。支持 {{title}} {{date}} {{time}} 和 {{date:YYYY-MM-DD}}; Templater 脚本模板不处理。不选 = 只建我们那一节。模板里「## " + headingNow + "」下面的文字会被第一条消息替换。");
      if (plugin._templateMissing && tplSetting.descEl && tplSetting.descEl.createSpan) {
        tplSetting.descEl.createSpan({ cls: "wd-path-preview-bad", text: " ⚠️ 上次建文件时没读到模板文件: " + plugin._templateMissing });
      }
      tplSetting.addText((t) => this._pathSuggest(t, {
        kind: "file", value: st.templatePath || "",
        onPick: async (v) => { st.templatePath = v || ""; plugin._templateMissing = ""; await plugin.persist(); },
      }));
      new Setting(containerEl)
        .setName("从每日笔记设置导入")
        .setDesc("读取 Obsidian「每日笔记」(或 Periodic Notes)的文件夹、日期格式、模板, 填进日记文件夹 / 路径格式 / 模板三项。会先让你确认。")
        .addButton((b) => b.setButtonText("导入").onClick(() => this._importDailyNotes()));
      const dsh = Number(st.dayStartHour);
      const dshVal = Number.isInteger(dsh) && dsh >= 0 && dsh <= 12 ? dsh : 4;
      const hourOpts = {};
      for (let h = 0; h <= 12; h++) hourOpts[String(h)] = h === 0 ? "0 点(和每日笔记一样, 零点算新的一天)" : h + " 点";
      new Setting(containerEl)
        .setName("一天从几点开始")
        .setDesc("插件默认凌晨 4 点才算新的一天(夜猫子睡前记的算前一晚); 每日笔记插件是零点。想和每日笔记一致就选 0。每日提醒的最晚时间也跟着变。")
        .addDropdown((d) => d.addOptions(hourOpts).setValue(String(dshVal))
          .onChange(async (v) => { st.dayStartHour = Number(v); setDayStartHour(st.dayStartHour); await plugin.persist(); this.display(); }));
    }

    // ── 附件 ──────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("附件").setHeading();
    const attMode = st.attachmentMode || "diary";
    const ATT_DESC = {
      diary: "存在日记文件夹内的 attachments/年 下(默认)。",
      obsidian: "按 Obsidian「文件与链接 → 附件默认存放路径」放。",
      custom: "存到下面选的文件夹。",
    };
    new Setting(containerEl)
      .setName("附件位置")
      .setDesc("图片、文件、视频、语音原声存在哪。" + ATT_DESC[attMode] + " 语音气泡只认文件名, 与位置无关。")
      .addDropdown((d) => d.addOptions({ diary: "日记文件夹内 (attachments/年)", obsidian: "跟随 Obsidian 的附件设置", custom: "自定义文件夹" })
        .setValue(attMode)
        .onChange(async (v) => { st.attachmentMode = v; await plugin.persist(); this.display(); }));
    if (attMode === "custom") {
      let attPreview = null;
      new Setting(containerEl)
        .setName("自定义附件文件夹")
        .setDesc("点进去选一个库里的文件夹(打字可以过滤)。要用新文件夹, 先在 Obsidian 文件列表里建好再来选。")
        .addText((t) => this._pathSuggest(t, {
          kind: "folder", allowRoot: true, value: st.attachmentFolder || "",
          onPick: async (v) => { st.attachmentFolder = v || ""; await plugin.persist(); if (attPreview) attPreview(); },
        }));
      const subSetting = new Setting(containerEl)
        .setName("按日期分子文件夹(可空)")
        .setDesc("在上面的文件夹下再按日期分层, 用日期代码写, 如 YYYY 或 YYYY/MM。留空就直接放在那个文件夹里。");
      let subDraft = st.attachmentSubFormat || "";
      let subTimer = null;
      attPreview = this._previewLine(subSetting, () => {
        const folder = String(st.attachmentFolder || "").trim();
        if (!folder && !subDraft.trim()) return { ok: true, text: "还没选: 先按默认位置(日记文件夹内的 attachments/年)存" };
        const v = subDraft.trim() ? validatePathFormat(subDraft, { requireDaily: false, momentLib: moment }) : { ok: true, value: "" };
        if (!v.ok) return { ok: false, text: v.error + " (没有保存)" };
        const base = folder === "/" ? "" : folder;
        const rel = v.value ? renderPath(v.value, todayD, moment) : "";
        return { ok: true, text: "附件会存到: " + (plugin.writer._join(base, rel) || "库根目录") + "/" };
      });
      subSetting.addText((t) => t.setPlaceholder("YYYY/MM").setValue(subDraft)
        .onChange((v) => {
          subDraft = v || "";
          this._clearLater(subTimer);
          subTimer = this._later(async () => {
            if (!subDraft.trim()) { if (st.attachmentSubFormat) { st.attachmentSubFormat = ""; await plugin.persist(); } attPreview(); return; }
            const r = validatePathFormat(subDraft, { requireDaily: false, momentLib: moment });
            if (r.ok && r.value !== st.attachmentSubFormat) { st.attachmentSubFormat = r.value; await plugin.persist(); }
            attPreview();
          }, 400);
        }));
    }

    new Setting(containerEl).setName("语音").setHeading();
    new Setting(containerEl)
      .setName("保存语音原声")
      .setDesc("开启后, 之后收到的语音在转写成文字的同时把原声也存进附件, 笔记里显示成可点击播放的语音条(微信样式), 下面是文字。音频约 3MB/分钟, 计入库体积、会被同步盘带走。默认只存文字; 已存过的语音条不受开关影响, 始终显示为气泡。")
      .addToggle((t) => t.setValue(!!plugin.settings.saveVoiceAudio)
        .onChange(async (v) => { plugin.settings.saveVoiceAudio = v; await plugin.persist(); }));

    new Setting(containerEl).setName("提醒").setHeading();
    new Setting(containerEl)
      .setName("每日提醒")
      .setDesc("到点时如果今天还什么都没记, 在微信上提醒你一次。只在这台电脑开着 Obsidian 时发得出; 连续 3 天没记就先不打扰, 等你回来再继续。")
      .addToggle((t) => t.setValue(plugin.settings.reminderEnabled !== false)
        .onChange(async (v) => { plugin.settings.reminderEnabled = v; await plugin.persist(); }));
    new Setting(containerEl)
      .setName("提醒时间")
      .setDesc((() => {
        const h = Number(plugin.settings.dayStartHour);
        const dsh = Number.isInteger(h) && h >= 0 && h <= 12 ? h : 4;
        if (dsh === 0) return "24 小时制, 如 21:30。一天从零点开始, 所以提醒最晚可设到 23:59";
        return "24 小时制, 如 21:30。凌晨 " + dsh + " 点前都算前一天, 所以提醒最晚可设到 " + String(dsh - 1).padStart(2, "0") + ":59";
      })())
      .addText((t) => {
        let lastValid = plugin.settings.reminderTime || "21:30";
        t.setPlaceholder("21:30").setValue(lastValid)
          .onChange(async (v) => {
            const val = (v || "").trim();
            if (REMINDER_TIME_RE.test(val)) {
              lastValid = val;
              plugin.settings.reminderTime = val;
              await plugin.persist();
            } else if (/^\d{1,2}:\d{2}$/.test(val)) {
              // 形状完整但越界(25:00/21:75): 提示并回退, 不能静默落盘让提醒永久哑掉
              new Notice("提醒时间超出范围, 仍是 " + lastValid);
              t.setValue(lastValid);
            }
            // 打到一半的中间态("21:"): 什么都不做, 存储保持上一个合法值
          });
      });

    new Setting(containerEl).setName("AI (暂未启用)").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "当前版本走纯机械记录, 不调用任何 AI——发什么原文存什么。这里的配置会保留, 将来 AI 功能回归时生效。",
    });

    new Setting(containerEl)
      .setName("接口地址")
      .setDesc("OpenAI 兼容接口的完整地址, 一般以 /v1/chat/completions 结尾")
      .addText((t) => t.setPlaceholder("https://api.example.com/v1/chat/completions")
        .setValue(plugin.settings.aiApiUrl)
        .onChange(async (v) => { plugin.settings.aiApiUrl = v.trim(); await plugin.persist(); }));

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("存在 Obsidian 的密钥存储里, 不进 vault 文件、不被同步盘带走")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-…").setValue(plugin.getAiKey() || "")
          .onChange((v) => { plugin.setAiKey(v.trim()); });
      });

    new Setting(containerEl)
      .setName("模型名")
      .addText((t) => t.setPlaceholder("deepseek-chat")
        .setValue(plugin.settings.aiModel)
        .onChange(async (v) => { plugin.settings.aiModel = v.trim(); await plugin.persist(); }));
  }
}

// ── 插件主类 ─────────────────────────────────────────────────────────────

const DEFAULT_DATA = () => ({
  settings: Object.assign({}, DEFAULT_SETTINGS),
  // 最近剪藏 URL → vault 路径, 用于重复链接复用；文件名 hash 扫描是 data.json 丢失后的第二道兜底。
  webClips: [],
  ilink: {
    botId: "", userId: "", baseUrl: "", buf: "",
    contextTokens: {}, recentSeqs: [], pauseUntil: 0, lastAliveTs: 0, loginTime: "",
    botTokenFallback: "", skipBacklog: false,
    fileMd5s: [], // 已收文件 {md5, path}, 最多 200 条——重复文件直接引用(绕 #193 解密坑)
  },
  // finalize_count: 手动收尾(结束/晚安)过几次; nudge_count: 夜间收尾提示说过几次(终身)——都是"这个人的习惯", 跟 profile 走
  profile: { state: "unknown", name: null, finalize_count: 0, nudge_count: 0 },
  // nudged_date: 夜间收尾提示今天说过没有(逻辑日)
  session: {
    mode: "chat", entered_date: "", chat_count_today: 0, last_activity_ts: 0, cost_reminder_shown_date: "", nudged_date: "",
    // 每日提醒(D10): reminded_date=今天试过了(逻辑日, 一天只试一次); reminder_streak=连发几次提醒都没等来内容
    // (写入即清零, ≥3 闭嘴等人回来); reminder_idx=文案轮换指针; reminder_last_result=最近一次发送结果(诊断用)
    reminded_date: "", reminder_streak: 0, reminder_idx: 0, reminder_last_result: "",
  },
});

class WechatDiaryPlugin extends Plugin {
  async onload() {
    const stored = (await this.loadData()) || {};
    const storedSettings = stored.settings && typeof stored.settings === "object" ? stored.settings : {};
    const base = DEFAULT_DATA();
    this.data = {
      settings: Object.assign(base.settings, storedSettings),
      webClips: Array.isArray(stored.webClips) ? stored.webClips : base.webClips,
      ilink: Object.assign(base.ilink, stored.ilink),
      profile: Object.assign(base.profile, stored.profile),
      session: Object.assign(base.session, stored.session),
    };
    // D11: 取名轮退役——老 data.json 里滞留在 awaiting_name 的迁移为 active
    if (this.data.profile.state === "awaiting_name") this.data.profile.state = "active";
    this.settings = this.data.settings;
    setTimezone(this.settings.timezone);
    setDayStartHour(this.settings.dayStartHour);
    setNudgeNightHour(this.settings.nudgeNightHour);

    // data.json 丢了但 token 还在(卸载重装/同步盘回滚)时, 从 secret 里把身份取回来。
    // 顺序在 setTimezone 之后、管道启动之前, 让后面所有判断看到的都是补全过的状态。
    let restored = false;
    if (!this.data.ilink.userId && this.getBotToken()) {
      const id = this.getBindIdentity();
      if (id) {
        const il = this.data.ilink;
        il.userId = id.userId;
        il.botId = il.botId || id.botId || "";
        il.baseUrl = il.baseUrl || id.baseUrl || "";
        il.skipBacklog = true;
        restored = true;
        await this.persist();
        console.log("[wechat-diary] 从密钥存储恢复了绑定身份");
      }
    }

    this.ai = new AiClient(this);
    this.writer = new DiaryWriter(this, this.ai);
    this.clipper = new WebClipper(this);
    this.chatHandler = new ChatHandler(this.ai);
    this.agent = new DiaryAgent(this);

    this._running = false;
    this._client = null;
    this._failCount = 0;
    this._noticedDown = false;
    this._sleepCancels = new Set();
    this._unloaded = false;
    this._activeQrModal = null;
    this._claiming = false;
    this._declinedClaims = new Set();   // 本次会话里答过"不是"的, 不再反复弹
    // 身份是从 secret 恢复来的 = data.json 没了 = 游标(buf)和去重表(recentSeqs)一起没了。
    // 此时服务端对空游标可能回吐一大段积压消息, 而去重表是空的 —— 照写就会把历史
    // 按【今天】的日期重演一遍(write() 用 todayStr(), 消息报文里没有原始时间),
    // 连「撤回」「结束」这类命令都会被重放。所以先把积压静默跳过, 等流量安静下来再落笔。
    this._skipBacklog = restored || Boolean(this.data.ilink.skipBacklog);

    this.settingTab = new WechatDiarySettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.statusEl = this.addStatusBarItem();
    this._setStatus("未绑定");

    this.addCommand({
      id: "open-today-note",
      name: "打开今天的日记",
      callback: async () => {
        const day = logicalTodayStr();
        const path = this.writer.diaryPath(day);
        // 共用模式(#15): 文件不存在先按用户模板建, 否则 Obsidian 会新建空文件, 每日笔记插件之后就不套模板了
        if (this.settings.sharedDailyNote && !this.app.vault.getFileByPath(path)) {
          try { await this.writer._createDayFile(day, ""); } catch (e) { console.error("[wechat-diary] 建今天的每日笔记失败:", e && e.message); }
        }
        this.app.workspace.openLinkText(path, "", false);
      },
    });

    // 每 5 分钟持久化一次心跳时间(离线提示与补收判断用)
    this.registerInterval(window.setInterval(() => {
      if (this._running) this.persist();
    }, 5 * 60 * 1000));

    // 语音气泡(D12): 把本插件写的语音附件(…-语音.wav)渲染成微信样式气泡, 点击即播。
    // 阅读视图走 post-processor; Live Preview 的 embed 不走它, 用 MutationObserver 兜底。
    // vault 里存的是标准 markdown+wav: 手机端/卸载插件后仍是原生播放器, 数据零锁定。
    this.registerMarkdownPostProcessor((el) => this._renderVoiceBubbles(el));
    this.app.workspace.onLayoutReady(() => {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return; // 渲染是增强, 非浏览器环境跳过
      // 攒批合帧: 打字/切文件时 CM6 高频增删节点, 逐节点扫太浪费; rAF 一帧处理一批
      const pending = new Set();
      let scheduled = false;
      const flush = () => {
        scheduled = false;
        const batch = [...pending];
        pending.clear();
        for (const n of batch) if (n.isConnected) this._renderVoiceBubbles(n);
      };
      const obs = new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n && n.nodeType === 1) pending.add(n);
        }
        if (pending.size && !scheduled) {
          scheduled = true;
          (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f) => setTimeout(f, 16))(flush);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      this.register(() => obs.disconnect());
      this._renderVoiceBubbles(document.body);
    });

    // 每日提醒(D10): 每分钟查一次该不该提醒。到点时 Obsidian 没开也没关系——
    // 之后打开, 只要还在同一个逻辑日、今天还没记, 这里就会补发。
    this.registerInterval(window.setInterval(() => {
      this._reminderTick().catch((e) => console.error("[wechat-diary] 提醒检查失败:", e));
    }, 60 * 1000));

    // 有 token 就起管道 —— 缺 userId 时进"待认领"模式(只推游标不落笔, 见 _handleIncoming),
    // 让用户发一条消息就能把自己认回来, 而不是卡在未绑定界面无路可走。
    this.app.workspace.onLayoutReady(() => {
      if (this.getBotToken()) this.startPipeline();
    });
  }

  onunload() {
    this._unloaded = true;
    if (this._voicePlayer) { try { this._voicePlayer.pause(); this._voicePlayer.src = ""; } catch (e) {} this._voicePlayer = null; }
    if (this._activeQrModal) {
      try { this._activeQrModal.close(); } catch (e) { /* noop */ }
      this._activeQrModal = null;
    }
    this.stopPipeline();
  }

  // ── 凭据 ──

  _secrets() { return this.app.secretStorage || null; }

  getBotToken() {
    const ss = this._secrets();
    if (ss) { const v = ss.getSecret(SECRET_BOT_TOKEN); if (v) return v; }
    return this.data.ilink.botTokenFallback || "";
  }

  setBotToken(token) {
    const ss = this._secrets();
    if (ss) { ss.setSecret(SECRET_BOT_TOKEN, token || ""); this.data.ilink.botTokenFallback = ""; }
    else this.data.ilink.botTokenFallback = token || "";
  }

  getAiKey() {
    const ss = this._secrets();
    if (ss) { const v = ss.getSecret(SECRET_AI_KEY); if (v) return v; }
    return "";
  }

  setAiKey(key) {
    const ss = this._secrets();
    if (ss) ss.setSecret(SECRET_AI_KEY, key || "");
    else new Notice("需要 Obsidian 1.11.4+ 才能安全保存 Key");
  }

  // 绑定身份的副本, 与 token 同库。data.json 没了(卸载/同步盘回滚)时靠它无感恢复。
  getBindIdentity() {
    const ss = this._secrets();
    if (!ss) return null;
    try {
      const raw = ss.getSecret(SECRET_BIND_ID);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && o.userId ? o : null;
    } catch (e) { return null; }   // 手改坏了就当没有, 不能让它挡住启动
  }

  setBindIdentity(userId, botId, baseUrl) {
    const ss = this._secrets();
    if (!ss) return;
    if (!userId) { ss.setSecret(SECRET_BIND_ID, ""); return; }
    ss.setSecret(SECRET_BIND_ID, JSON.stringify({ userId, botId: botId || "", baseUrl: baseUrl || "" }));
  }

  // 三态: bound(可用) / half(有凭据缺主人, 待认领) / none。
  // v0.2.1 之前这里是二值的, 半绑定被错判成"未绑定", 于是解绑按钮被禁用、
  // 残留 token 又顶得重新扫码必回 binded_redirect —— 用户被锁死在里面出不来。
  bindState() {
    if (!this.getBotToken()) return "none";
    return this.data.ilink.userId ? "bound" : "half";
  }

  async persist() { await this.saveData(this.data); }

  _setStatus(text) { this.statusEl.setText("📖 微信日记: " + text); }

  // ── 绑定生命周期 ──

  async onLoginConfirmed({ botToken, botId, userId, baseUrl }) {
    if (this._unloaded) return; // 弹窗可能活得比插件久, 别在已卸载实例上起管道
    this.stopPipeline();
    this.setBotToken(botToken);
    const il = this.data.ilink;
    const sameUser = il.userId === userId;
    // ⚠️ seq 不是全局 id, 是每个 bot 会话从 1 重数的计数器(8/13 实测踩坑):
    // 同一微信号换了新 bot 时保留旧 recentSeqs/buf, 会把新 bot 的前 N 条消息
    // 静默吞掉(当时哑了一整天)。游标和去重表必须按【bot】判, 不能只按微信号。
    const sameBot = sameUser && il.botId === botId;
    Object.assign(il, {
      botId, userId, baseUrl,
      loginTime: new Date().toISOString(),
      pauseUntil: 0,
      buf: sameBot ? il.buf : "",
      contextTokens: sameBot ? il.contextTokens : {},   // context_token 也是 bot 会话级
      recentSeqs: sameBot ? il.recentSeqs : [],
    });
    if (!sameUser) {
      this.data.profile = { state: "unknown", name: null };
      this.data.session = DEFAULT_DATA().session;
    }
    il.skipBacklog = false;                       // 重新登录 = 重新算账, 不带着上一轮的跳过状态
    this._skipBacklog = false;
    this.setBindIdentity(userId, botId, baseUrl); // 与 token 同库, 卸载重装后能自己回来
    await this.persist();
    this.startPipeline();
    this._refreshSettingsUi(); // 绑定成功后设置页立即显示"已绑定", 不能还挂着扫码按钮
  }

  // 待认领状态下有人发来消息: 弹一次确认。同一个 from 不重复弹, 弹窗开着时也不叠。
  _askClaimOwner(from) {
    if (this._unloaded || this._claiming) return;
    if (this._declinedClaims && this._declinedClaims.has(from)) return;
    this._claiming = true;
    // explicit: 点了"不是"才拉黑; 叉掉/Esc 只放开锁, 下条消息还会再问
    new ClaimOwnerModal(this.app, from, async (ok, explicit) => {
      this._claiming = false;
      if (ok) await this.adoptOwner(from);
      else if (explicit && this._declinedClaims) this._declinedClaims.add(from);
    }).open();
  }

  // 认回主人: 只补身份, 不动日记、不动 settings。
  async adoptOwner(userId) {
    if (this._unloaded || !userId || this.data.ilink.userId) return;
    const il = this.data.ilink;
    il.userId = userId;
    il.loginTime = il.loginTime || new Date().toISOString();
    // 走到认领 = buf 游标必然是空的(不然身份不会丢), 服务端可能还在回吐积压。
    // 认领后同样先只推游标, 等一次空轮询再落笔 —— 提示文案"再发一条就开始记"说的就是这个。
    il.skipBacklog = true;
    this._skipBacklog = true;
    this.setBindIdentity(userId, il.botId, il.baseUrl);
    await this.persist();
    this._setStatus("已连接");
    this._refreshSettingsUi();
    new Notice("认回来了 📖 再发一条就开始记");
  }

  _refreshSettingsUi() {
    try {
      const t = this.settingTab;
      if (t && t.containerEl && t.containerEl.childElementCount > 0) t.display();
    } catch (e) { /* 设置页没开着, 不用刷 */ }
  }

  // keepToken: 只清主人身份, 留着凭据回到"待认领"(认错人时的复位入口)。
  // 默认 false = 连凭据一起清, 这一步可能不可逆, 调用方必须先确认过。
  async unbind(keepToken) {
    this.stopPipeline();
    const token = keepToken ? this.getBotToken() : "";
    const keep = this.data.settings;
    this.data = DEFAULT_DATA();
    this.data.settings = keep;
    this.settings = keep;
    // 必须在重置 data 之后写: 没有 secretStorage 的宿主上 token 就落在 data.ilink 里,
    // 先写会被 DEFAULT_DATA() 抹掉 —— keepToken 会变成静默失效。
    this.setBotToken(token);
    this.setBindIdentity("");   // 身份副本一起清, 否则下次 onload 又给"恢复"回来
    this._declinedClaims = new Set();  // 复位后重新开放认领
    await this.persist();
    if (token) { this.startPipeline(); return; }   // 待认领: 管道继续跑, 等人发消息
    this._setStatus("未绑定");
  }

  // ── 消息管道 ──

  startPipeline() {
    if (this._running) return;
    this._pollSettledTs = 0; // 新管道必须先完成一轮拉取, 提醒才可信(重扫码换管道时旧值不能沿用)
    try {
      this._client = new ILinkClient();
    } catch (e) {
      this._setStatus("仅桌面端可用");
      return;
    }
    this._client.token = this.getBotToken();
    this._client.baseUrl = this.data.ilink.baseUrl;
    this._running = true;
    this._failCount = 0;
    this._noticedDown = false;
    this.agent.offlineNotice = this._computeOfflineNotice();
    if (!this._isPaused()) this._client.notify("notifystart");
    this._setStatus(this.bindState() === "half" ? "待认领, 给 bot 发条消息" : "已连接");
    this._loop().catch((e) => {
      console.error("[wechat-diary] 管道异常退出:", e);
      this._running = false;
      this._setStatus("管道异常, 重启插件恢复");
    });
  }

  // 解除"只推游标不落笔"。两个入口都要调: 空批次, 和长轮询超时。
  // 落盘: 追平之前用户关掉 Obsidian 的话, 下次启动 userId 已在 data.json 里(不再走恢复分支),
  // 光靠内存标志会失效, 那一整段积压就会在下次启动时被当成新消息写进今天。
  async _clearSkipBacklog() {
    if (!this._skipBacklog) return;
    this._skipBacklog = false;
    this.data.ilink.skipBacklog = false;
    const n = this._skippedCount || 0;
    this._skippedCount = 0;
    await this.persist();
    if (n) new Notice("微信日记: 已跳过离线期间的 " + n + " 条历史消息, 现在开始正常记录");
  }

  _isPaused() {
    const p = this.data.ilink.pauseUntil;
    return Boolean(p && Date.now() < p);
  }

  // ── 语音气泡渲染(D12) ──────────────────────────────────────────────────
  _renderVoiceBubbles(root) {
    if (!root || !root.querySelectorAll) return;
    const sel = '.internal-embed[src*="-语音"]';
    const list = root.querySelectorAll(sel);
    for (const el of list) this._voiceBubbleFor(el);
    if (root.matches && root.matches(sel)) this._voiceBubbleFor(root);
  }

  _voiceBubbleFor(el) {
    try {
      const src = (el.getAttribute("src") || "").split("#")[0].split("|")[0].trim();
      // 只认本插件的完整命名(attachments/年/日期-时间-语音[-重试后缀].wav)——
      // 用户自己名字带"语音"的 wav 一概不碰(审稿轮抓出「英语语音作业.wav」误伤)
      // 只看文件名不看目录(#15: 附件位置可配置后目录不固定); 兼容 Obsidian 撞名后缀「语音 1.wav」
      if (!/(^|\/)\d{4}-\d{2}-\d{2}-\d{4}-语音(?:-[0-9a-f]{4}| \d+)*\.wav$/.test(src)) return;
      if (el.dataset.wdVoice) return;
      const file = this.app.metadataCache.getFirstLinkpathDest(src, "");
      if (!file) return; // 先别打标: metadataCache 未就绪时留给下一轮重试(审稿轮抓出)
      el.dataset.wdVoice = "1";
      // 时长从文件大小算(24kHz/16bit/mono PCM), 不为每个气泡开 Audio 读 metadata
      const sec = Math.max(1, Math.round(Math.max(0, ((file.stat && file.stat.size) || 0) - 44) / (SILK_WAV_SAMPLE_RATE * 2)));
      const bubble = document.createElement("div");
      bubble.className = "wd-voice-bubble";
      bubble.setAttribute("role", "button");
      bubble.setAttribute("tabindex", "0");
      const baseLabel = "播放语音, " + sec + " 秒";
      bubble.setAttribute("aria-label", baseLabel);
      bubble.dataset.wdBaseLabel = baseLabel;
      const icon = document.createElement("span");
      icon.className = "wd-voice-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path class="wd-arc wd-arc1" d="M6 9 Q9 12 6 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="wd-arc wd-arc2" d="M9 6.5 Q14 12 9 17.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="wd-arc wd-arc3" d="M12 4 Q19 12 12 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      const dur = document.createElement("span");
      dur.className = "wd-voice-dur";
      dur.textContent = sec + "″";
      bubble.appendChild(icon);
      bubble.appendChild(dur);
      bubble.style.minWidth = Math.min(220, 64 + sec * 3) + "px";
      const activate = (ev) => { ev.preventDefault(); ev.stopPropagation(); this._toggleVoice(file, bubble); };
      bubble.addEventListener("click", activate);
      bubble.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") activate(ev); });
      // 不 replaceChildren: 阅读视图里 Obsidian 的 embed 加载器在 post-processor 之后才把原生播放器
      // 填进来(实测确定性时序, 审稿轮抓出"气泡+原生并存")——原生部分交给 CSS 隐藏, 与填充顺序无关
      el.classList.add("wd-voice-embed");
      el.appendChild(bubble);
    } catch (e) { /* 渲染失败保留原生播放器 */ }
  }

  // 共享单个播放器: 同时只放一条(微信行为); Live Preview 反复重建 widget 也不会攒 Audio、
  // 不会有失控续播的孤儿(审稿轮抓出)。点同一条=暂停, 点别的=切歌。
  _toggleVoice(file, bubble) {
    try {
      const url = this.app.vault.getResourcePath(file);
      if (!this._voicePlayer) {
        this._voicePlayer = new Audio();
        this._voicePlayer.addEventListener("ended", () => this._setVoiceBubbleState(false));
        this._voicePlayer.addEventListener("pause", () => this._setVoiceBubbleState(false));
        this._voicePlayer.addEventListener("play", () => this._setVoiceBubbleState(true));
      }
      const a = this._voicePlayer;
      const same = this._voiceBubbleEl === bubble && a.src === url;
      if (same && !a.paused) { a.pause(); return; }
      if (this._voiceBubbleEl && this._voiceBubbleEl !== bubble) this._setVoiceBubbleState(false);
      this._voiceBubbleEl = bubble;
      if (a.src !== url) a.src = url;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (e) { /* 播放失败静默 */ }
  }

  _setVoiceBubbleState(playing) {
    const b = this._voiceBubbleEl;
    if (!b) return;
    b.classList.toggle("wd-playing", playing);
    b.setAttribute("aria-label", playing ? "暂停语音" : (b.dataset.wdBaseLabel || "播放语音"));
  }

  // 每日提醒(D10)。发送前提: 管道活着且最近一轮拉取已完成(_pollSettledTs 新鲜)——
  // 电脑刚唤醒时今天的消息可能还没补收进来, 这时 countDay()=0 是假象, 不能催人。
  // 一天只试一次(先记账再发, 网络错也不重试, 防"发成功但响应丢了"的双发); 结果记在
  // session.reminder_last_result 里攒数据——提醒到底发不发得出去, 019 时代没人知道, 现在按返回码见分晓。
  async _reminderTick() {
    if (!this._running || !this._client || this._skipBacklog || this._isPaused()) return;
    const il = this.data.ilink;
    if (!il.userId) return;
    if (!this._pollSettledTs || Date.now() - this._pollSettledTs > 3 * 60 * 1000) return;
    const s = this.data.session;
    const now = new Date();
    const ctx = {
      enabled: this.settings.reminderEnabled, timeStr: this.settings.reminderTime || "21:30",
      now, countToday: 0, remindedDate: s.reminded_date, streak: s.reminder_streak,
    };
    // 先用 countToday=0 预判: 其余条件不满足就不必读文件(每分钟 tick, 关着提醒也读一遍太浪费)
    if (!reminderDue(ctx)) return;
    ctx.countToday = await this.writer.countDay();
    if (!reminderDue(ctx)) return;
    s.reminded_date = logicalTodayStr(now);
    const text = reminderText(s.reminder_idx || 0);
    s.reminder_idx = ((s.reminder_idx || 0) + 1) % REMINDER_LINES.length;
    await this.persist();
    const genBefore = this._writeGen || 0; // 发送在途时的新写入不该被 streak++ 覆盖
    try {
      await this._client.sendText(il.userId, text, il.contextTokens[il.userId]);
      if ((this._writeGen || 0) === genBefore) s.reminder_streak = (s.reminder_streak || 0) + 1;
      s.reminder_last_result = "ok " + new Date().toISOString();
    } catch (e) {
      s.reminder_last_result = "fail " + ((e && (e.ilinkCode || e.message)) || "?") + " " + new Date().toISOString();
      if (e && e.ilinkCode === STALE_TOKEN_ERRCODE) il.pauseUntil = Date.now() + SESSION_PAUSE_MS;
      console.error("[wechat-diary] 提醒发送失败:", e && e.message);
    }
    await this.persist();
  }

  stopPipeline() {
    if (!this._running && !this._client) return;
    this._running = false;
    if (this._client) {
      this._client.notify("notifystop");
      const c = this._client;
      window.setTimeout(() => c.destroyAll(), 500); // 给 notifystop 半秒钟发出去
      this._client = null;
    }
    for (const cancel of [...this._sleepCancels]) cancel();
    this.data.ilink.lastAliveTs = Date.now();
    this.persist();
  }

  _computeOfflineNotice() {
    const ts = this.data.ilink.lastAliveTs;
    if (!ts) return null;
    const gapH = (Date.now() - ts) / 3600000;
    if (gapH < OFFLINE_NOTICE_GAP_H) return null;
    return "(小提示: 我离线超过一天了(约 " + Math.floor(gapH) + " 小时), 太早的消息可能没补到, " +
      "翻一下聊天记录, 漏了的可以再发我一次)";
  }

  _interruptibleSleep(ms) {
    // Set 而非单字段: 理论上只有一个 loop 在睡, 但生命周期切换的瞬间可能有两个
    return new Promise((resolve) => {
      const cancel = () => { window.clearTimeout(t); this._sleepCancels.delete(cancel); resolve(); };
      const t = window.setTimeout(() => { this._sleepCancels.delete(cancel); resolve(); }, ms);
      this._sleepCancels.add(cancel);
    });
  }

  async _loop() {
    // 代数守卫: 重新扫码会换 client 实例; 任何 await 回来后发现 client 换了就自杀,
    // 否则旧 loop 会和新 loop 并发轮询同一个 buf(双循环 bug)
    const client = this._client;
    const dead = () => !this._running || this._client !== client;
    let pollTimeout = LONG_POLL_TIMEOUT_MS;
    while (!dead()) {
      const il = this.data.ilink;
      // -14 冷却: 不清 token 不重登, 用同一 token 同一 buf 等冷却结束继续
      if (this._isPaused()) {
        const left = il.pauseUntil - Date.now();
        this._setStatus("冷却中, " + Math.ceil(left / 60000) + " 分钟后恢复");
        await this._interruptibleSleep(Math.min(left, 60000));
        continue;
      }

      let r;
      try {
        r = await client.getUpdates(il.buf, pollTimeout);
      } catch (e) {
        if (dead()) break;
        this._failCount += 1;
        if (this._failCount >= 5 && !this._noticedDown) {
          this._noticedDown = true;
          this._setStatus("连不上微信服务, 重试中");
        }
        if (this._failCount >= 3) { this._failCount = 0; await this._interruptibleSleep(30000); }
        else await this._interruptibleSleep(2000);
        continue;
      }
      if (dead()) break;
      // 长轮询正常心跳 = 服务端没东西给了 = 积压追平。必须在这里也解除跳过:
      // 服务端到底会不会返回一个 msgs 为空的响应是未知的(协议笔记 P0 第 1 条),
      // 只认"空 msgs"的话, 一旦它选择 hold 到超时, _skipBacklog 就永远解不掉,
      // 插件会安静地再也不写日记 —— 比重复写还糟。
      if (r.__timeout) { this._pollSettledTs = Date.now(); await this._clearSkipBacklog(); continue; }

      const code = respCode(r.json);
      if (code === STALE_TOKEN_ERRCODE) {
        il.pauseUntil = Date.now() + SESSION_PAUSE_MS;
        await this.persist();
        continue;
      }
      if (code !== 0) {
        this._failCount += 1;
        if (this._failCount >= 3) { this._failCount = 0; await this._interruptibleSleep(30000); }
        else await this._interruptibleSleep(2000);
        continue;
      }

      this._failCount = 0;
      if (this._noticedDown) { this._noticedDown = false; this._setStatus("已连接"); }
      il.lastAliveTs = Date.now();
      this._pollSettledTs = Date.now(); // 一轮拉取完成: 今天的积压已进来, 提醒的 countDay 才可信

      if (typeof r.json.longpolling_timeout_ms === "number" && r.json.longpolling_timeout_ms > 0) {
        pollTimeout = r.json.longpolling_timeout_ms;
      }

      // 官方是先推进 cursor 再处理; 日记场景反过来——整批处理完才推进 buf,
      // 中途退出/崩溃就重放这一批(recentSeqs 去重兜底), 用户的话不静默丢
      const msgs = Array.isArray(r.json.msgs) ? r.json.msgs : [];

      if (msgs.length === 0) await this._clearSkipBacklog(); // 空批次同样说明追平了

      let batchDone = true;
      for (const msg of msgs) {
        if (dead()) { batchDone = false; break; }
        try { await this._handleIncoming(msg); }
        catch (e) { console.error("[wechat-diary] 处理消息失败:", e); }
      }
      if (batchDone && !dead() && r.json.get_updates_buf) {
        il.buf = r.json.get_updates_buf;
        await this.persist();
      }
    }
  }

  async _handleIncoming(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.message_type === 2) return; // BOT 自己的消息
    if (msg.message_state === 1) return; // GENERATING 半成品
    const il = this.data.ilink;

    const from = msg.from_user_id || "";
    if (!from) return;

    // 待认领: 有 token 但 userId 丢了。这里一个字都不写 —— 游标照常推进(_loop),
    // 服务端积压的旧消息因此被干净跳过, 不会在日记里重复成一片。认领要用户在
    // Obsidian 里点确认: 协议层没有 allowlist, 不弹窗就等于谁先发消息谁当主人。
    if (!il.userId) { this._askClaimOwner(from); return; }

    // 恢复身份后的第一波: 只推游标不落笔(见 onload 处 _skipBacklog 的说明)
    if (this._skipBacklog) { this._skippedCount = (this._skippedCount || 0) + 1; return; }

    // 白名单: 协议层没有 allowlist, 陌生人可直达 bot。
    // 不回复(等于确认 bot 存活)、不存 token(data.json 会被陌生人无限撑大), 静默丢弃
    if (from !== il.userId) return;

    const seqKey = msg.seq != null ? "s" + msg.seq : (msg.message_id != null ? "m" + msg.message_id : "");
    if (seqKey) {
      if (il.recentSeqs.includes(seqKey)) return;
      il.recentSeqs.push(seqKey);
      if (il.recentSeqs.length > MAX_RECENT_SEQS) il.recentSeqs.splice(0, il.recentSeqs.length - MAX_RECENT_SEQS);
    }

    if (msg.context_token) il.contextTokens[from] = msg.context_token;

    // 提取文本: iLink 会把长内容拆成同一条消息的多个 item, 全部拼接
    let text = "";
    let hasText = false;
    let hasVoice = false;
    const images = [], voices = [], files = [], videos = [];
    let voiceAudio = null;
    for (const item of msg.item_list || []) {
      if (item.type === 1 && item.text_item) { text += item.text_item.text || ""; hasText = true; }
      else if (item.type === 3 && item.voice_item) {
        hasVoice = true;
        const vt = item.voice_item.text || "";
        if (vt) {
          text += vt;
          // D12: 开了「保存语音原声」→ 转写文字照走意图识别, 若是记录则原声+文字同块
          if (this.settings.saveVoiceAudio && item.voice_item.media) voiceAudio = item.voice_item;
        }
        else if (item.voice_item.media) voices.push(item.voice_item); // 转写失败: 存原音频兜底(D10)
      }
      else if (item.type === 2 && item.image_item) { images.push(item.image_item); }
      else if (item.type === 4 && item.file_item) { files.push(item.file_item); }   // D10: 文件照收
      else if (item.type === 5 && item.video_item) { videos.push(item.video_item); } // D10: 视频照收
    }
    if (!hasText && !hasVoice && !images.length && !files.length && !videos.length) return; // 未知类型仍忽略
    const isVoice = hasVoice && !hasText;

    const reply = await this.agent.onMessage(from, text, isVoice, images, { voices, files, videos, voiceAudio });
    if (reply && from) {
      // 冷却期不出站(官方 assertSessionActive 语义): 日记已写入, 只是确认回执发不出
      if (this._isPaused() || !this._client) return;
      try {
        await this._client.sendText(from, reply, il.contextTokens[from]);
        if (this.agent.commitNudge()) await this.persist();
      } catch (e) {
        if (e && e.ilinkCode === STALE_TOKEN_ERRCODE) {
          il.pauseUntil = Date.now() + SESSION_PAUSE_MS;
          await this.persist();
        }
        console.error("[wechat-diary] 回复失败:", e && e.message);
      }
    }
  }
}

// ── 内嵌 SILK 解码器(D12) ────────────────────────────────────────────────
// silk-wasm@3.7.1 (MIT © 2024 idranme, https://github.com/idranme/silk-wasm) 整段内嵌:
// 官方微信插件同款方案(其 silk-transcode.ts 用的就是这个包)。两处 silk_default() 已按
// wasmBinary 注入方式打补丁(短路文件/网络加载, 兼容 Obsidian 渲染进程), wasm 以 base64 内嵌。
// 零构建约束下这是唯一可行路径: SILK 解码无纯 JS 实现, 原生绑定包又装不进插件。
let _silkLibCache;
function getSilkLib() {
  if (_silkLibCache !== undefined) return _silkLibCache;
  try {
    if (!globalThis.__SILK_WASM__) globalThis.__SILK_WASM__ = Buffer.from(SILK_WASM_B64, "base64");
    const mod = { exports: {} };
    _silkEmbedded(mod, mod.exports, require, (typeof __filename !== "undefined" ? __filename : "/wechat-diary/main.js"));
    _silkLibCache = mod.exports;
  } catch (e) {
    console.error("[wechat-diary] SILK 解码器初始化失败(语音原声不可用):", e && e.message);
    _silkLibCache = null;
  }
  return _silkLibCache;
}
const SILK_WASM_B64 = "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BQYHCAkKCwwNDg8eHyA5IDv9DQ4PDA0KCwgJBgcEBQIDAAEiOyA7/Q0ODwwNCgsICQYHBAUCAwAB/Y8B/QsEACAFQQhqIgVBmAFHDQALIApBgIB+Qf//ASAKLgGqogEiAyAKLgGoogEiBGoiACAAQf//AU4bIgAgAEGAgH5MGzsBqqIBIApBgIB+Qf//ASADIAouAayiASIFaiIAIABB//8BThsiACAAQYCAfkwbOwGsogEgCkGAgH5B//8BIAQgCi4BpqIBIgNqIgAgAEH//wFOGyIAIABBgIB+TBs7AaiiASAKQYCAfkH//wEgAyAKLgGkogEiBGoiACAAQf//AU4bIgAgAEGAgH5MGzsBpqIBIApBgIB+Qf//ASAEIAouAaKiASIDaiIAIABB//8BThsiACAAQYCAfkwbOwGkogEgCkGAgH5B//8BIAMgCi4BoKIBaiIAIABB//8BThsiACAAQYCAfkwbOwGiogEgCkGAgH5B//8BIAUgOf0YAGoiACAAQf//AU4bIgAgAEGAgH5MGzsBrqIBIApBoKIBakGgAUHQABAsIgAEQCAKIAr9AASgogEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwSgogEgCiAK/QAEsKIBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsEsKIBIAogCv0ABMCiASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBMCiASAKIAr9AATQogEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwTQogEgCiAK/QAE4KIBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsE4KIBIAogCv0ABPCiASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBPCiASAKIAr9AASAowEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwSAowEgCiAK/QAEkKMBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsEkKMBIAogCv0ABKCjASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBKCjASAKIAr9AASwowEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwSwowEgCiAK/QAEwKMBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsEwKMBIAogCv0ABNCjASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBNCjASAKIAr9AATgowEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwTgowEgCiAK/QAE8KMBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsE8KMBIAogCv0ABICkASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBICkASAKIAr9AASQpAEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwSQpAEgCiAK/QAEoKQBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsEoKQBIAogCv0ABLCkASI5/acBIAD9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAD9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBLCkASAKIAr9AATApAEiOf2nASAA/awB/Qz//wAA//8AAP//AAD//wAA/U4gOf2oASAA/awB/Qz//wAA//8AAP//AAD//wAA/U79hgH9CwTApAEgCiAK/QAE0KQBIjn9pwEgAP2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgAP2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsE0KQBCyArQf//ASAjGyEfIBZBEmwhICAWQQF0IS4gFkEobCIkQQN1IRggCkH6PWohAyAKQcCjAWohCUEAIRdBASENIApBwDpqIhMhBwNAIAn9AwE4IkQgRP21ASAJ/QMBMCI7IDv9tQEgCf0DASgiQyBD/bUBIAn9AwEgIj0gPf21ASAJ/QMBGCJCIEL9tQEgCf0DARAiPyA//bUBIAn9AwEIIkAgQP21ASAJ/QMBACI+ID79tQEgCUEIa/0DAQAiPCA8/bUBIAlBEGsiBf0DAQAiOiA6/bUB/a4B/a4B/a4B/a4B/a4B/a4B/a4B/a4B/a4BIjkgOSBE/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSBE/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIgRBgOIJaiEAIAdB//8BQYCAfiBEIAn9AwFI/bUBIDsgCf0DAUD9tQEgQyBE/bUBID0gO/21ASBCIEP9tQEgPyA9/bUBIEAgQv21ASA+ID/9tQEgPCBA/bUBIDogPv21Af2uAf2uAf2uAf2uAf2uAf2uAf2uAf2uAf2uASI5IDkgOf0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACAEQYGedk4EfwJ/AkACQCAAQYCABE8EQCAAQRB2IQQCfyAAQYCAgAhPBEAgAEGAgICAAU8EQCAEQQx2IQhBAAwCCyAEQQh2IQhBBAwBCyAEIARBBHYgAEGAgMAASSIEGyEIQQxBCCAEGwshBCAIQQxxRQ0BIAhBCHFFIARyIQgMAgsCfyAAQYACTwRAIABBgCBPBEAgAMFBDHUhCEEADAILIABBgP4DcUEIdiEIQQQMAQsgACAAQfD/A3FBBHYgAEEQSSIEGyEIQQxBCCAEGwsgCEEMcQR/IAhBCHFFBUECQQMgCEECcRsLciIEQRByIghBGEkNASAAIARBCGt0DAILQQJBAyAIQQJxGyAEciEICyAAIAhBCGp3CyEHQYCAAkGG6QIgCEEBcRsgCEEBdnYiBCAEIAdB/wBxbEHVAWxBEHZqQQFqBUEBC20iBCAEQYCAfkwbIgQgBEH//wFOGzsBACAJ/QMBSCE7IAn9AwFAIUMgCf0DATghPSAJ/QMBMCFCIAn9AwEoIT8gCf0DASAhQCAJ/QMBGCE+IAn9AwEQITwgCf0DAQghOiAJ/QMBACE5QQkhCCAKQbA6aiAXQboDbGohDwNAIA8gCEEBdGpB//8BQYCAfiAF/QMBRiA7/bUBIAX9AwE+IEP9tQEgBf0DATYgPf21ASAF/QMBLiBC/bUBIAX9AwEmID/9tQEgBf0DAR4gQP21ASAF/QMBFiA+/bUBIAX9AwEOIDz9tQEgBf0DAQYgOv21ASAFQQJrIgT9AwEAIDn9tQH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgEiRCBEIET9DQgJCgsMDQ4PAAECAwABAgP9rgEiRCBEIET9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAgACAFLgFOIgcgBC4BACIFaiAFIAdrbGoiAEEASgR/An8CQAJAIABBgIAETwRAIABBEHYhBQJ/IABBgICACE8EQCAAQYCAgIABTwRAIAVBDHYhBUEADAILIAVBCHYhBUEEDAELIAUgBUEEdiAAQYCAwABJIgcbIQVBDEEIIAcbCyEHIAVBDHFFDQEgBUEIcUUgB3IhBQwCCwJ/IABBgAJPBEAgAEGAIE8EQCAAwUEMdSEFQQAMAgsgAEGA/gNxQQh2IQVBBAwBCyAAIABB8P8DcUEEdiAAQRBJIgcbIQVBDEEIIAcbCyEHIAVBDHEEfyAFQQhxRQVBAkEDIAVBAnEbCyAHciIHQRByIgVBGEkNASAAIAdBCGt0DAILQQJBAyAFQQJxGyAHciEFCyAAIAVBCGp3CyEHQYCAAkGG6QIgBUEBcRsgBUEBdnYiBSAFIAdB/wBxbEHVAWxBEHZqQQFqBUEBC20iBSAFQYCAfkwbIgUgBUH//wFOGzsBACAEIQUgCEEBaiIIQckARw0ACyAJQdAAaiEJQQEhFyANQQFxQQAhDSADIQcNAAsgCkHcPWohByAKQaI6aiEE/QxEAAAAQwAAAEIAAABBAAAAITv9DEgAAABHAAAARgAAAEUAAAAhOkEAIQUDQCAEQcgAIAVrQQF0IgNqIgAgAyAHav0AAgAiPyA7/Q0ODwwNCgsICQYHBAUCAwABIj79pwEgAP0AAQAiQCA7/Q0ODwwNCgsICQYHBAUCAwABIjn9pwH9rgFBEf2sASA6QRT9qwH9oQFBEP2sASI8/bUBID4gOf1OID4gOf1RQQH9jAH9jgEiPv2nASI5/a4BIDn9DP//AAD//wAA//8AAP//AAD9TiA8/bUBQRD9rQH9rgH9DP//AAD//wAA//8AAP//AAD9TiA/IDv9DQYHBAUCAwABAAEAAQABAAH9pwEgQCA7/Q0GBwQFAgMAAQABAAEAAQAB/acB/a4BQRH9rAEgO0EU/asB/aEBQRD9rAEiPP21ASA+/agBIjn9rgEgOf0M//8AAP//AAD//wAA//8AAP1OIDz9tQFBEP2tAf2uAf0M//8AAP//AAD//wAA//8AAP1O/YYBIDv9DQ4PDA0KCwgJBgcEBQIDAAH9CwEAIDr9DPj////4////+P////j////9rgEhOiA7/Qz4////+P////j////4/////a4BITsgBUEIaiIFQcAARw0AC0EAIQUgCiAKLgH6PSAKLgHAOmoiA0EBdSIAIANBCnZBgP8DcWtBACAAQQd0QYD//wNxa0EQdmo7AcA6IDBBAXQiCEEEaiEEAkACQAJAIDBBf04EQCAIQXxPDQEgBEH8////B3EhBf0MAAAAAAEAAAACAAAAAwAAACE7QQAhAANAIApB0DlqIABBAnRqIDv9CwQAIDv9DAQAAAAEAAAABAAAAAQAAAD9rgEhOyAAQQRqIgAgBUcNAAsgBCAFRw0BDAILIBMgCEEDaiIAQQF0aiEIIApB0DlqIABBAnRqIQkgEyAEQQF0aiIALgEAIgMgAEECay4BACIASgRAIAggAzsBACAJIAQ2AgAgAyEACyAEQcAARg0CIARBAXIhBQNAIBMgBUEBdGouAQAiAyAAwUoEQCAIIAM7AQAgCSAFNgIAIAMhAAsgEyAFQQFqIgdBAXRqLgEAIgMgAMFKBEAgCCADOwEAIAkgBzYCACADIQALIAVBAmoiBUHBAEcNAAsMAgsDQCAKQdA5aiAFQQJ0aiAFNgIAIAVBAWoiBSAERw0ACwtBASEHA0AgEyAHQQF0ai4BACEJIAchBQJAA0AgCSATIAVBAWsiAEEBdGouAQAiA0wNASATIAVBAXRqIAM7AQAgCkHQOWoiAyAFQQJ0aiAAQQJ0IANqKAIANgIAIAVBAUogACEFDQALQQAhBQsgEyAFQQF0aiAJOwEAIApB0DlqIAVBAnRqIAc2AgAgB0EBaiIHIARHDQALIDBBHkoNACAIQQJqIQAgEyAEQQF0akECayEPIAQhBwNAIAAhBSATIAdBAXRqLgEAIg0gDy4BAEoEQANAAkAgEyAFQQF0ai4BACIDIA1OBEAgBSEIDAELIBMgBUEBaiIJQQF0aiADOwEAIApB0DlqIgMgCUECdGogBUECdCADaigCADYCAEF/IQggBUEASiAFQQFrIQUNAQsLIBMgCEEBaiIDQQF0aiANOwEAIApB0DlqIANBAnRqIAc2AgALIAdBAWoiB0HBAEcNAAsLAn8CQCAKLgHAOiIDIANsQf///w8gCv0DA9ikASI5IDn9tQEgCv0DA9CkASI5IDn9tQEgCv0DA8ikASI5IDn9tQEgCv0DA8CkASI5IDn9tQEgCv0DA7ikASI5IDn9tQEgCv0DA7CkASI5IDn9tQEgCv0DA6ikASI5IDn9tQEgCv0DA6CkASI5IDn9tQEgCv0DA5ikASI5IDn9tQEgCv0DA5CkASI5IDn9tQEgCv0DA4ikASI5IDn9tQEgCv0DA4CkASI5IDn9tQEgCv0DA/ijASI5IDn9tQEgCv0DA/CjASI5IDn9tQEgCv0DA+ijASI5IDn9tQEgCv0DA+CjASI5IDn9tQEgCv0DA9ijASI5IDn9tQEgCv0DA9CjASI5IDn9tQEgCv0DA8ijASI5IDn9tQEgCv0DA8CjASI5IDn9tQH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgEiOSA5IDn9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5IDn9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAiAEHoB2pBBnUgAEGXeEwbSA0AIApBgjZqIQkCfwJAAn8gMEF/TgRAIC9BEHUgA2wgL0H//wNxIANsQRB1aiEHQQAhBQNAIAUgCkGwOmogBUEBdGoiAy4BECAHTA0CGiAKQdA5aiAFQQJ0aiIAIAAoAgBBAXRBEGo2AgAgBUEBciEXIAMuARIgB0wEQCAKQaY2akEAQZQC/AsADAQLIApB0DlqIBdBAnRqIgAgACgCAEEBdEEQajYCACAFQQJqIgUgBEcNAAsLIAQLIRcgCkGmNmpBAEGUAvwLAEEAIBdBAEwNARoLQQAhBQJAIBdBA0sEQCAXQfz///8HcSEFQQAhCANAIApBkDZqIgMgCkHQOWogCEECdGoiACgCAEEBdGpBATsBACAAKAIEQQF0IANqQQE7AQAgACgCCEEBdCADakEBOwEAIAAoAgxBAXQgA2pBATsBACAIQQRqIgggBUcNAAsgBSAXRg0BCwNAIApBkDZqIApB0DlqIAVBAnRqKAIAQQF0akEBOwEAIAVBAWoiBSAXRw0ACwsgCi8BtDgL/RAhOkEAIQUDQCAJQZMBIAVrQQF0aiIAIAlBkQEgBWtBAXRq/QACACI5IDogOf0NEhMUFRYXGBkaGxwdHh8OD/2OASAA/QADAP2OAf0LAwAgOSA5/Q0ODwwNCgsICQYHBAUCAwABITogBUEIaiIFQYABRw0ACyAKIAovAbA2IgMgCi8BrjZqIgAgCi8BrDZqOwGwNiAKIAovAbQ2IAMgCi8BsjYiBGpqOwG0NiAKIAAgBGo7AbI2IAogCi8BtjYgBCA5/RkAamo7AbY2QRAhBQNAIApBkDZqIAVBAWoiA0EBdGouAQBBAEoEQCAKQdA5aiAqQQJ0aiAFNgIAICpBAWohKgsgCkGQNmogBUECaiIAQQF0ai4BAEEASgRAIApB0DlqICpBAnRqIAM2AgAgKkEBaiEqCyAKQZA2aiAFQQNqIgVBAXRqLgEAQQBKBEAgCkHQOWogKkECdGogADYCACAqQQFqISoLIAVBkQFHDQALQQAhBSAK/QgBtDghOiAK/QgBsjghPwNAIAlBkwEgBWtBAXRqIgAgPyAJQZABIAVrQQF0av0AAQAiPP0NDg8eHxwdGhsYGRYXFBUSEyI5IDogOf0NDg8QERITFBUWFxgZGhscHf2OASA8IDn9DQ4PDA0KCwgJBgcEBQIDAAEiP/2OASA5/Q0ODwwNCgsICQYHBAUCAwABIAD9AAMA/Y4B/QsDACA5ITogBUEIaiIFQYABRw0ACyAKIAovAbI2IAovAaw2IgAgCi8BrjYiAyAKLwGwNiIEampqOwGyNiAKIAQgCi8BqjYgACADampqOwGwNiAKIAovAbY2IAQgPP0ZACIAIDz9GQFqamo7AbY2IAogCi8BtDYgAyAAIARqamo7AbQ2QQAhDUEQIQUDQCAKQZA2aiIAIAVBAXRqLgEAQQBKBEAgDUEBdCAAaiAFQQJrOwEAIA1BAWohDQsgCkGQNmoiAyAFQQFyIgBBAXRqLgEAQQBKBEAgDUEBdCADaiAAQQJrOwEAIA1BAWohDQsgBUECaiIFQZQBRw0ACyAKQYCmAWpBwAJBKBAsIgQEQEEAIQADQCAKQYCmAWogAEEBdGoiAyAD/QAEACI5/acBIAT9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAT9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBAAgAyAD/QAEECI5/acBIAT9rAH9DP//AAD//wAA//8AAP//AAD9TiA5/agBIAT9rAH9DP//AAD//wAA//8AAP//AAD9Tv2GAf0LBBAgAEEQaiIAQcACRw0ACwtBACEEIApBsDpqQQBB6A38CwAgCkHAqAFqIQ8gDUEATCEiA0AgIkUEQCAP/QMBSCI5IDn9tQEgD/0DAUAiRCI6IDr9tQEgD/0DATgiOyI6IDr9tQEgD/0DATAiQyI6IDr9tQEgD/0DASgiPSI6IDr9tQEgD/0DASAiQiI6IDr9tQEgD/0DARgiPyI6IDr9tQEgD/0DARAiQCI6IDr9tQEgD/0DAQgiPiI6IDr9tQEgD/0DAQAiPCI6IDr9tQH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgEiOiA6IDr9DQgJCgsMDQ4PAAECAwABAgP9rgEiOiA6IDr9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhF0EAIQAgCkGwOmogBEG6A2xqIRkDQEEAIQggDyAKQZA2aiAAQQF0ai4BAEEBdCITayID/QMBSCJJIDn9tQEgA/0DAUAiSiBE/bUBIAP9AwE4IksgO/21ASAD/QMBMCJMIEP9tQEgA/0DASgiTSA9/bUBIAP9AwEgIkggQv21ASAD/QMBGCJFID/9tQEgA/0DARAiRyBA/bUBIAP9AwEIIkEgPv21ASAD/QMBACJGIDz9tQH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgH9rgEiOiA6IEn9DQgJCgsMDQ4PAAECAwABAgP9rgEiOiA6IEn9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAiGkEASgRAIBcgSSBJ/bUBIEogSv21ASBLIEv9tQEgTCBM/bUBIE0gTf21ASBIIEj9tQEgRSBF/bUBIEcgR/21ASBBIEH9tQEgRiBG/bUB/a4B/a4B/a4B/a4B/a4B/a4B/a4B/a4B/a4BIjogOiA6/Q0ICQoLDA0ODwABAgMAAQID/a4BIjogOiA6/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIgggCCAXSBshCQJAIBpBgIAETwRAIBpBEHYhAwJ/IBpBgICACE8EQCAaQYCAgIABTwRAIANBDHYhB0EADAILIANBCHYhB0EEDAELIAMgA0EEdiAaQYCAwABJIgUbIQdBDEEIIAUbCyEFIAdBDHEEQCAFIAdBCHFFciEHDAILIAdBAnEEQCAFQQJyIQcMAgsgBUEDciEHDAELAn8gGkGAAk8EQCAaQYAgTwRAIBrBQQx1IQdBAAwCCyAaQYD+A3FBCHYhB0EEDAELIBogGkHw/wNxQQR2IBpBEEkiAxshB0EMQQggAxsLIQMgB0EMcQR/IAdBCHFFBUECQQMgB0ECcRsLIANyQRByIQdBACEDCwJ/IBpBDyAHQQFrIgVBACAFIAdNGyAHQRBLGyIFdCAJQQ8gBWt1QQFqbcEiBSAaQf//A3FsQRB1IAMgBWxqIgNBAXQiCUGAgARPBEAgCUEQdiEDAn8gCUGAgIAITwRAIAlBgICAgAFPBEAgA8FBDHUhB0EADAILIANBCHYhB0EEDAELIAMgA0EEdiAJQYCAwABJIgMbIQdBDEEIIAMbCyEDIAMgB0EIcUVyIAdBDHENARogA0ECciAHQQJxDQEaIANBA3IMAQsCf0EQIANFDQAaAn8gCUGAAk8EQCAJQYAgTwRAIAnBQQx1IQdBAAwCCyAJQYD+A3FBCHYhB0EEDAELIAkgCUHw/wNxQQR2IAlBEEkiAxshB0EMQQggAxsLIQMgAyAHQQhxRXIgB0EMcQ0AGiADQQJyIAdBAnENABogA0EDcgtBEGoLIQUgCUEPIAVBAWsiA0EAIAMgBU0bIAVBEEsbIgN0IBcgCCAIIBdKG0EPIANrdUEBam0hCAsgEyAZaiAIOwEAIABBAWoiACANRw0ACwsgD0HQAGohDyAEQQFqIgRBBEcNAAsCfyAMQQBMBEBBAAwBCwJAIBZBDEYEQCAMQQF0QQNtIQwMAQsgFkEQRgRAIAxBAXYhDAwBCyAWQRhHDQAgDEEDbiEMCyAMQQBKIS0gDBAZCyEpAkAgKkEASgRAIB8gH2xBDXYhIUEDQQsgFkEIRyAwQQBMciImGyIVQQNrIQAgFUEHayEnQYCAgIB4IQRBfyEDQQAhDEEAIQlBgICAgHghDQNAIApB0DlqIAxBAnRqKAIAIRNBACEFA0AgCkHgNWogBUECdGogCkGwOmogEyAFQQF0IgdBgNcBai4BAGpBAXRqLgEAIBMgB0GW1wFqLgEAakEBdCAKakHqPWouAQBqIBMgB0Gs1wFqLgEAakEBdCAKakGkwQBqLgEAaiATIAdBwtcBai4BAGpBAXQgCmpB3sQAai4BAGo2AgAgBUEBaiIFIBVHDQALQYCAgIB4IQVBACEZQQAhF0EAIQ9BACEIQQAhByAmRQRAA0AgCkHgNWoiByAXQQNyIihBAnRqKAIAIi8gF0ECciIrQQJ0IAdqKAIAIiMgF0EBciIaQQJ0IAdqKAIAIgggF0ECdCAHaigCACIHIAUgBSAHSCIfGyIFIAUgCEgiIhsiBSAFICNIIggbIgUgBSAvSCIHGyEFICggKyAaIBcgDyAfGyAiGyAIGyAHGyEPIBcgJ0cgF0EEaiEXDQALIAAhCCAPIQcLA0AgCkHgNWogCEECdGooAgAiDyAFIAUgD0giDxshBSAIIAcgDxshByAIQQFqIQggGUEBaiIZQQNHDQALIAUgExAZIg9B6MwBbEEHdWshCCAtBEAgCCAPIClrIgggCGxBB3YiCCAOLgH8sgFB6MwBbEEPdWwgCEFAa21rIQgLAkAgBCAITg0AIAUgIUwNACAHQQF0QYDXAWouAQBBEEoNACAFIQ0gCCEEIBMhAyAHIQkLIAxBAWoiDCAqRw0ACyADQX9HDQELDAELAkACQAJAIBZBCU4EQAJAIAYgJCAYECwiD0UNAEEBICQgJEEBTBshB0EAIQUCQCAkQQhIDQAgB0H4////B3EhBUEAIQgDQCAIQQF0IgQgCkGgyABqIgBqIAQgBmr9AAEAIjn9pwEgD/2sAf0M//8AAP//AAD//wAA//8AAP1OIDn9qAEgD/2sAf0M//8AAP//AAD//wAA//8AAP1O/YYB/QsEACAIQQhqIgggBUcNAAsgBSAHRw0AIAAhBgwBCwNAIAVBAXQiBCAKQaDIAGoiAGogBCAGai4BACAPdTsBACAFQQFqIgUgB0cNAAsgACEGCyAgAn8gA8EiACADQRB0QRF1aiAWQQxGDQAaIANBAXQgFkEQRg0AGiAAQQNsCyIAIC4gACAuShsgACAgShsiE0ECaiEhIBNBAmsiAyAuSiEAICAgIUohLyADIC4gABshIiAOIA1BDXQiBEEASgR/QYCAAkGG6QICfyAEQYCABE8EQCAEQRB2IQACfyAEQYCAgAhPBEAgBEGAgICAAU8EQCAAQQx2IQBBAAwCCyAAQQh2IQBBBAwBCyAAIABBBHYgBEGAgMAASSIDGyEAQQxBCCADGwsiAyAAQQhxRXIgAEEMcQ0BGkECQQMgAEECcRsgA3IMAQsCfyAEwUEMdSIAQQxxBEAgAEEIcUUMAQtBAkEDIARBgMAAcRsLQRByCyIDQQFxGyADQQF2diIAIARBGCADa3ZB/wBxbEHVAWxBEHYgAGoFQQALNgL8sgEgFCAJQQF0IgBBwtcBai4BAEEBdCATajYCeCAUIABBrNcBai4BAEEBdCATajYCdCAUIABBltcBai4BAEEBdCATajYCcCAUIABBgNcBai4BAEEBdCATajYCbCAwQQF0IgBBoKkBaiIrLwEAwSImIABBpqkBaiIjLgEAIgNqIS0gBiAkaiEkICZBAEoNAiAwQQR0IhdB8KgBai4BACIMIBdB8qgBai4BACIPSg0BIBhB/P///wdxIQQgDyAMa0EBaiEIQQAhCSAYQQRJIQcgDCENA0BBACEFAkAgGEEATA0AICQgDSAiakEBdGshGQJAIAcEQEEAIQAMAQv9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIBkgBUEBdCIAav0DAQAgACAkav0DAQD9tQEgO/2uASE7IAVBBGoiBSAERw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEFIAQiACAYRg0BCwNAIAUgGSAAQQF0IgZqLgEAIAYgJGouAQBsaiEFIABBAWoiACAYRw0ACwsgCkHAIGogCUECdGogBTYCACANQQFqIQ0gCUEBaiIJIAhHDQALDAELQQAhBCAOIA1BACANQQBKG0ENdCIFQQBKBH9BgIACQYbpAgJ/IAVBgIAETwRAIAVBEHYhAAJ/IAVBgICACE8EQCAFQYCAgIABTwRAIABBDHYhAEEADAILIABBCHYhAEEEDAELIAAgAEEEdiAFQYCAwABJIgYbIQBBDEEIIAYbCyIGIABBCHFFciAAQQxxDQEaQQJBAyAAQQJxGyAGcgwBCwJ/IAXBQQx1IgBBDHEEQCAAQQhxRQwBC0ECQQMgBUGAwABxGwtBEHILIgZBAXEbIAZBAXZ2IgAgBUEYIAZrdkH/AHFsQdUBbEEQdiAAagVBAAs2AvyyASAUIAMgCUEBdCIAQcLXAWouAQBqNgJ4IBQgAyAAQazXAWouAQBqNgJ0IBQgAyAAQZbXAWouAQBqNgJwIBQgAyAAQYDXAWouAQBqNgJsIANBEGsMBAsgJCAYQQF0Ih9qISggF0H0qAFqLgEAIgYgF0H2qAFqLgEAIhlMBEAgGEH8////B3EhByAZIAZrQQFqIRdBACENIBhBBEkhCCAGIQQDQEEAIQUCQCAYQQBMDQAgKCAEICJqQQF0ayEaAkAgCARAQQAhAAwBC/0MAAAAAAAAAAAAAAAAAAAAACE7A0AgGiAFQQF0IgBq/QMBACAAIChq/QMBAP21ASA7/a4BITsgBUEEaiIFIAdHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQUgByIAIBhGDQELA0AgBSAaIABBAXQiCWouAQAgCSAoai4BAGxqIQUgAEEBaiIAIBhHDQALCyAKQcAgaiANQQJ0aiAFNgIAIARBAWohBCANQQFqIg0gF0cNAAsLIB8gKGohJyAwQQR0IihB+KgBai4BACIHIChB+qgBai4BACIqTARAIBhB/P///wdxIQkgKiAHa0EBaiEfQQAhDSAYQQRJIRcgByEEA0BBACEFAkAgGEEATA0AICcgBCAiakEBdGshGgJAIBcEQEEAIQAMAQv9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIBogBUEBdCIAav0DAQAgACAnav0DAQD9tQEgO/2uASE7IAVBBGoiBSAJRw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEFIAkiACAYRg0BCwNAIAUgGiAAQQF0IghqLgEAIAggJ2ouAQBsaiEFIABBAWoiACAYRw0ACwsgCkHAIGogDUECdGogBTYCACAEQQFqIQQgDUEBaiINIB9HDQALCyAoQfyoAWouAQAiCSAoQf6oAWouAQAiFUoNASAnIBhBAXRqIScgGEH8////B3EhCCAVIAlrQQFqIRpBACENIBhBBEkhHyAJIQQDQEEAIQUCQCAYQQBMDQAgJyAEICJqQQF0ayEoAkAgHwRAQQAhAAwBC/0MAAAAAAAAAAAAAAAAAAAAACE7A0AgKCAFQQF0IgBq/QMBACAAICdq/QMBAP21ASA7/a4BITsgBUEEaiIFIAhHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQUgCCIAIBhGDQELA0AgBSAoIABBAXQiF2ouAQAgFyAnai4BAGxqIQUgAEEBaiIAIBhHDQALCyAKQcAgaiANQQJ0aiAFNgIAIARBAWohBCAaIA1BAWoiDUcNAAsMAQsgMEEEdCIAQfCoAWouAQAiDCAAQfKoAWouAQAiD0wEQCAYQfz///8HcSEEIA8gDGtBAWohCEEAIQkgGEEESSEHIAwhDQNAQQAhBQJAIBhBAEwNACAkIA0gImpBAXRrIRkCQCAHBEBBACEADAEL/QwAAAAAAAAAAAAAAAAAAAAAITsDQCAZIAVBAXQiAGr9AwEAIAAgJGr9AwEA/bUBIDv9rgEhOyAFQQRqIgUgBEcNAAsgOyA7IDv9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5IDn9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhBSAEIgAgGEYNAQsDQCAFIBkgAEEBdCIGai4BACAGICRqLgEAbGohBSAAQQFqIgAgGEcNAAsLIApBwCBqIAlBAnRqIAU2AgAgDUEBaiENIAlBAWoiCSAIRw0ACwsgCkHAIGogDEECdGshB0EAIQUgAyEAA0AgCkGgC2ogAyAFakEUbGoiBiAHIABBAXRB4NcBai4BAEECdGoiBP0AAgD9CwIAIAYgBCgCEDYCECAFQQFqIQUgAEEBaiIAIC1IDQALICQgGEEBdGohGiAwQQR0IgBB9KgBai4BACIGIABB9qgBai4BACIZTARAIBhB/P///wdxIQcgGSAGa0EBaiEXQQAhDSAYQQRJIQggBiEEA0BBACEFAkAgGEEATA0AIBogBCAiakEBdGshHwJAIAgEQEEAIQAMAQv9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIB8gBUEBdCIAav0DAQAgACAaav0DAQD9tQEgO/2uASE7IAVBBGoiBSAHRw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEFIAciACAYRg0BCwNAIAUgHyAAQQF0IglqLgEAIAkgGmouAQBsaiEFIABBAWoiACAYRw0ACwsgCkHAIGogDUECdGogBTYCACAEQQFqIQQgDUEBaiINIBdHDQALCyAKQaALaiADQRRsaiInQagFaiEIIApBwCBqIAZBAnRrIQlBACEFIAMhAANAIAggBUEUbGoiByAJIABBAXRBpNgBai4BAEECdGoiBP0AAgD9CwIAIAcgBCgCEDYCECAFQQFqIQUgAEEBaiIAIC1IDQALIBogGEEBdGohKCAwQQR0IgBB+KgBai4BACIHIABB+qgBai4BACIqTARAIBhB/P///wdxIQkgKiAHa0EBaiEfQQAhDSAYQQRJIRcgByEEA0BBACEFAkAgGEEATA0AICggBCAiakEBdGshGgJAIBcEQEEAIQAMAQv9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIBogBUEBdCIAav0DAQAgACAoav0DAQD9tQEgO/2uASE7IAVBBGoiBSAJRw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEFIAkiACAYRg0BCwNAIAUgGiAAQQF0IghqLgEAIAggKGouAQBsaiEFIABBAWoiACAYRw0ACwsgCkHAIGogDUECdGogBTYCACAEQQFqIQQgDUEBaiINIB9HDQALCyAnQdAKaiENIApBwCBqIAdBAnRrIQhBACEFIAMhAANAIA0gBUEUbGoiCSAIIABBAXRB6NgBai4BAEECdGoiBP0AAgD9CwIAIAkgBCgCEDYCECAFQQFqIQUgAEEBaiIAIC1IDQALIDBBBHQiAEH8qAFqLgEAIgkgAEH+qAFqLgEAIhVMBEAgKCAYQQF0aiEpIBhB/P///wdxIQggFSAJa0EBaiEaQQAhDSAYQQRJIR8gCSEEA0BBACEFAkAgGEEATA0AICkgBCAiakEBdGshKAJAIB8EQEEAIQAMAQv9DAAAAAAAAAAAAAAAAAAAAAAhOwNAICggBUEBdCIAav0DAQAgACApav0DAQD9tQEgO/2uASE7IAVBBGoiBSAIRw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEFIAgiACAYRg0BCwNAIAUgKCAAQQF0IhdqLgEAIBcgKWouAQBsaiEFIABBAWoiACAYRw0ACwsgCkHAIGogDUECdGogBTYCACAEQQFqIQQgDUEBaiINIBpHDQALCyAnQfgPaiEXIApBwCBqIAlBAnRrIQ1BACEFIAMhAANAIBcgBUEUbGoiCCANIABBAXRBrNkBai4BAEECdGoiBP0AAgD9CwIAIAggBCgCEDYCECAFQQFqIQUgAEEBaiIAIC1IDQALCyAhICAgLxshF0EAIQACQAJAAkAgJkEATARAICQgDCAiakEBdGshCAJAIBhBAEwNAEEAIQUgGEEETwRAIBhB/P///wdxIQX9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIAggAEEBdGr9AwEAIjkgOf21ASA7/a4BITsgAEEEaiIAIAVHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQAgBSAYRg0BCwNAIAAgCCAFQQF0ai4BACIDIANsaiEAIAVBAWoiBSAYRw0ACwsgDCAPSARAIA8gDGtBAWohBEEBIQUDQCAKQcCtAWogBUECdGogACAIIBggBWtBAXRqLgEAIgAgAGxrIgMgCCAFQQF0ay4BACIAIABsaiIAQf////8HIAAgAEH/////B08bIANBAEgbIgA2AgAgBUEBaiIFIARHDQALCyAkIBhBAXRqIgggBiAiakEBdGshDyAYQQBKDQFBACEADAILICQgDCAiakEBdGshDQJAIBhBAEwNAEEAIQUgGEEETwRAIBhB/P///wdxIQX9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIA0gAEEBdGr9AwEAIjkgOf21ASA7/a4BITsgAEEEaiIAIAVHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQAgBSAYRg0BCwNAIAAgDSAFQQF0ai4BACIEIARsaiEAIAVBAWoiBSAYRw0ACwsgCiAANgLArQEgDCAPSARAIA8gDGtBAWohCEEBIQUDQCAKQcCtAWogBUECdGogACANIBggBWtBAXRqLgEAIgAgAGxrIgQgDSAFQQF0ay4BACIAIABsaiIAQf////8HIAAgAEH/////B08bIARBAEgbIgA2AgAgBUEBaiIFIAhHDQALCyAKQcCtAWogDEECdGshD0EAIQUgAyEAA0AgCkHAIGogAyAFakEUbGoiCCAPIABBAXRB4NcBai4BAEECdGoiBP0AAgD9CwIAIAggBCgCEDYCECAFQQFqIQUgAEEBaiIAIC1IDQALICQgGEEBdGoiDSAGICJqQQF0ayEPAkAgGEEATARAQQAhAAwBC0EAIQBBACEFIBhBBE8EQCAYQfz///8HcSEF/QwAAAAAAAAAAAAAAAAAAAAAITsDQCAPIABBAXRq/QMBACI5IDn9tQEgO/2uASE7IABBBGoiACAFRw0ACyA7IDsgO/0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDkgOf0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEAIAUgGEYNAQsDQCAAIA8gBUEBdGouAQAiBCAEbGohACAFQQFqIgUgGEcNAAsLIAogADYCwK0BIAYgGUgEQCAZIAZrQQFqIQhBASEFA0AgCkHArQFqIAVBAnRqIAAgDyAYIAVrQQF0ai4BACIAIABsayIEIA8gBUEBdGsuAQAiACAAbGoiAEH/////ByAAIABB/////wdPGyAEQQBIGyIANgIAIAVBAWoiBSAIRw0ACwsgCkHAIGogA0EUbGoiDEGoBWohDyAKQcCtAWogBkECdGshCEEAIQUgAyEAA0AgDyAFQRRsaiIGIAggAEEBdEGk2AFqLgEAQQJ0aiIE/QACAP0LAgAgBiAEKAIQNgIQIAVBAWohBSAAQQFqIgAgLUgNAAsgDSAYQQF0aiIPIAcgImpBAXRrIQgCQCAYQQBMBEBBACEADAELQQAhAEEAIQUgGEEETwRAIBhB/P///wdxIQX9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIAggAEEBdGr9AwEAIjkgOf21ASA7/a4BITsgAEEEaiIAIAVHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQAgBSAYRg0BCwNAIAAgCCAFQQF0ai4BACIEIARsaiEAIAVBAWoiBSAYRw0ACwsgCiAANgLArQEgByAqSARAICogB2tBAWohBkEBIQUDQCAKQcCtAWogBUECdGogACAIIBggBWtBAXRqLgEAIgAgAGxrIgQgCCAFQQF0ay4BACIAIABsaiIAQf////8HIAAgAEH/////B08bIARBAEgbIgA2AgAgBUEBaiIFIAZHDQALCyAMQdAKaiEIIApBwK0BaiAHQQJ0ayEHQQAhBSADIQADQCAIIAVBFGxqIgYgByAAQQF0QejYAWouAQBBAnRqIgT9AAIA/QsCACAGIAQoAhA2AhAgBUEBaiEFIABBAWoiACAtSA0ACyAPIBhBAXRqIAkgImpBAXRrIQcCQCAYQQBMBEBBACEADAELQQAhAEEAIQUgGEEETwRAIBhB/P///wdxIQX9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIAcgAEEBdGr9AwEAIjkgOf21ASA7/a4BITsgAEEEaiIAIAVHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQAgBSAYRg0BCwNAIAAgByAFQQF0ai4BACIAIABsaiEAIAVBAWoiBSAYRw0ACwsgCiAANgLArQEgCSAVSARAIBUgCWtBAWohBkEBIQUDQCAKQcCtAWogBUECdGogACAHIBggBWtBAXRqLgEAIgAgAGxrIgQgByAFQQF0ay4BACIAIABsaiIAQf////8HIAAgAEH/////B08bIARBAEgbIgA2AgAgBUEBaiIFIAZHDQALCyAMQfgPaiEHIApBwK0BaiAJQQJ0ayEGQQAhBQNAIAcgBUEUbGoiBCAGIANBAXRBrNkBai4BAEECdGoiAP0AAgD9CwIAIAQgACgCEDYCECAFQQFqIQUgA0EBaiIDIC1IDQALDAILQQAhAEEAIQUgGEEETwRAIBhB/P///wdxIQX9DAAAAAAAAAAAAAAAAAAAAAAhOwNAIA8gAEEBdGr9AwEAIjkgOf21ASA7/a4BITsgAEEEaiIAIAVHDQALIDsgOyA7/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOSA5/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQAgBSAYRg0BCwNAIAAgDyAFQQF0ai4BACIDIANsaiEAIAVBAWoiBSAYRw0ACwsgBiAZSARAIBkgBmtBAWohBEEBIQUDQCAKQcCtAWogBUECdGogACAPIBggBWtBAXRqLgEAIgAgAGxrIgMgDyAFQQF0ay4BACIAIABsaiIAQf////8HIAAgAEH/////B08bIANBAEgbIgA2AgAgBUEBaiIFIARHDQALCyAIIBhBAXRqIgYgByAiakEBdGshCAJAIBhBAEwEQEEAIQAMAQtBACEAQQAhBSAYQQRPBEAgGEH8////B3EhBf0MAAAAAAAAAAAAAAAAAAAAACE7A0AgCCAAQQF0av0DAQAiOSA5/bUBIDv9rgEhOyAAQQRqIgAgBUcNAAsgOyA7IDv9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5IDn9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhACAFIBhGDQELA0AgACAIIAVBAXRqLgEAIgMgA2xqIQAgBUEBaiIFIBhHDQALCyAHICpIBEAgKiAHa0EBaiEEQQEhBQNAIApBwK0BaiAFQQJ0aiAAIAggGCAFa0EBdGouAQAiACAAbGsiAyAIIAVBAXRrLgEAIgAgAGxqIgBB/////wcgACAAQf////8HTxsgA0EASBsiADYCACAFQQFqIgUgBEcNAAsLIAYgGEEBdGogCSAiakEBdGshBgJAIBhBAEwEQEEAIQAMAQtBACEAQQAhBSAYQQRPBEAgGEH8////B3EhBf0MAAAAAAAAAAAAAAAAAAAAACE7A0AgBiAAQQF0av0DAQAiOSA5/bUBIDv9rgEhOyAAQQRqIgAgBUcNAAsgOyA7IDv9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5IDn9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhACAFIBhGDQELA0AgACAGIAVBAXRqLgEAIgAgAGxqIQAgBUEBaiIFIBhHDQALCyAJIBVODQAgFSAJa0EBaiEEQQEhBQNAIApBwK0BaiAFQQJ0aiAAIAYgGCAFa0EBdGouAQAiACAAbGsiAyAGIAVBAXRrLgEAIgAgAGxqIgBB/////wcgACAAQf////8HTxsgA0EASBsiADYCACAFQQFqIgUgBEcNAAsLQQAhBAJAIBcgIkgEQEEAIQkMAQsgFyAia0EBaiEfQc2ZAyATbkELdCEMICMuAQAiBiArLgEAaiENQYCAgIB4IRlBACEJQQAhAwNAIAYhAANAQQAhCCADQQJ0IgcgAEEUbCIFIApBoAtqamoiD0H4D2ooAgBBAnUgDygCqAVBAnUgDygCAEECdWogD0HQCmooAgBBAnVqaiIaQQBKBEAgCkHAIGogBWogB2oiBUH4D2ooAgBBAnUgBSgCqAVBAnUgBSgCAEECdWogBUHQCmooAgBBAnVqaiEPAn8gGkGAgARPBEAgGkEQdiEXAn8gGkGAgIAITwRAIBpBgICAgAFPBEAgF0EMdiEIQQAMAgsgF0EIdiEIQQQMAQsgFyAXQQR2IBpBgIDAAEkiBRshCEEMQQggBRsLIQUgBSAIQQhxRXIgCEEMcQ0BGiAFQQJyIAhBAnENARogBUEDcgwBC0EAIRcCfyAaQYACTwRAIBpBgCBPBEAgGsFBDHUhCEEADAILIBpBgP4DcUEIdiEIQQQMAQsgGiAaQfD/A3FBBHYgGkEQSSIFGyEIQQxBCCAFGwsgCEEMcQR/IAhBCHFFBUECQQMgCEECcRsLckEQcgshCCAMIABBEWsiBWwgBWxBgIB8cUGAgPz/B3NBEHUiB0H/////B0H//wFBgIB+IBpBDSAIQQFrIgVBACAFIAhNGyAIQQ5LGyIFdCAPQQ0gBWt1QQFqbSIFIAVBgIB+TBsiBSAFQf//AU4bIgUgGkH//wNxbEEQdSAFIBdsaiIFQQN0IAVB/////wBKGyIFQf//A3FsQRB1IAVBEHUgB2xqQQF0IQgLAkAgCCAZTA0AICIgAEEBdEHg1wFqLgEAaiAgSg0AICIhEyAIIRkgACEJCyAAQQFqIgAgDUgNAAsgIkEBaiEiIANBAWoiAyAfRw0ACwsgFCATIAlBAXQiAEGs2QFqLgEAajYCeCAUIBMgAEHo2AFqLgEAajYCdCAUIBMgAEGk2AFqLgEAajYCcCAUIBMgAEHg1wFqLgEAajYCbCATIC5rDAELIBT9DAAAAAAAAAAAAAAAAAAAAAD9CwJsIA5BADYC/LIBQQEhBEEAIQlBAAshACAUIAk2AgQgFCAANgIAIBQgBDYCaCAKQaCuAWokAP0MAAAAAAAAAAAAAAAAAAAAACE8IwBBwAlrIhEkACARQQA2AtwHIA4oAtx2ISsgFCAOKAKEswEgDigCkLMBQQd0IgBBEHVBs2ZsaiAAQYD/A3FBzRlsQRB2ayIANgLcBCAOKAKUswEiBUGBAU4EQCAUIAAgDigCoLMBQQF1ayIANgLcBAsgFCAUKALwBCAUKALsBGpBAnUiBzYC0AQgFAJ/IABBgBJrQQN1QQFqQQF1IgRBAEgEQEEAIARBwX5JDQEaQQAgBGsiBEEDdkH8////AXEiA0GQFmooAgAgA0GwFmouAQAgBEEfcWxrDAELQf//ASAEQb8BSw0AGiAEQQN2Qfz///8BcSIDQbAWai4BACAEQR9xbCADQdAWaigCAGoLIiNBAXUiKDYC1ARBACEDICjBIhogB0GAgAFqIgRB//8DcWwgKCAEQRB2bEEQdGpBEHUiBkEAQYACIAVrIgRBCHRBgP4DcSAEwWwgBCAEQQh2bEEQdGpBEHVBBHRrIgRBEHVsIABqIARB8P8DcSAGbEEQdWohLwJ/IBQoAmhFBEAgDigC/LIBIBRBADYC4AQgFEEANgJkQRB0QRd1IC9qDAELQYCAgIAEIAdBEHRrQRB1Ih8gAMFB5swBbEEQdSAAQRB0QQ91a0GAGGoiF0EQdWwhIiAOKALIdkEBdCEmQQAhACAbQQJxBEBBASEDIBsuAQAiACAAbCEACyAmQQFrISECfwNAQQAgAyAhTg0BGiADQQF0IQQgA0ECaiEDIAAgBCAbaigCACIGQRB1IgQgBGxqIAbBIgAgAGxqIgBBAE4NAAsgAEECdiEAQQILIRUgAyAhSARAA0AgACAbIANBAXRqKAIAIgbBIgQgBGwgBkEQdSIEIARsaiAVdmoiAEECdiAAIABBAEgiBBshACAVQQJqIBUgBBshFSADQQJqIgMgIUgNAAsLIAMgIUYEQCAAIBsgIUEBdGouAQAiAyADbCAVdmohAAtBACEDIAAgAEECdiAAQYCAgIAESSIAGyAmIBUgFUECaiAAG3VqEBkhB0EAIQAgGyAmQQF0aiIJQQJxBEBBASEDIAkuAQAiACAAbCEACwJ/A0BBACADICFODQEaIANBAXQhBCADQQJqIQMgACAEIAlqKAIAIgZBEHUiBCAEbGogBsEiACAAbGoiAEEATg0ACyAAQQJ2IQBBAgshFSADICFIBEADQCAAIAkgA0EBdGooAgAiBsEiBCAEbCAGQRB1IgQgBGxqIBV2aiIAQQJ2IAAgAEEASCIEGyEAIBVBAmogFSAEGyEVIANBAmoiAyAhSA0ACwsgAyAhRgRAIAAgCSAhQQF0ai4BACIDIANsIBV2aiEACyARIBUgFUECaiAAQYCAgIAESSIEGyIDNgLcByARICYgA3UgACAAQQJ2IAQbaiIANgLYByAAEBkiBSAHayIAIABBH3UiGXMhE0EAIQNBACEAIAkgJkEBdGoiCUECcQRAQQEhAyAJLgEAIgAgAGwhAAsCfwNAQQAgAyAhTg0BGiADQQF0IQQgA0ECaiEDIAAgBCAJaigCACIGQRB1IgQgBGxqIAbBIgAgAGxqIgBBAE4NAAsgAEECdiEAQQILIRUgAyAhSARAA0AgACAJIANBAXRqKAIAIgbBIgQgBGwgBkEQdSIEIARsaiAVdmoiAEECdiAAIABBAEgiBBshACAVQQJqIBUgBBshFSADQQJqIgMgIUgNAAsLIAMgIUYEQCAAIAkgIUEBdGouAQAiAyADbCAVdmohAAsgACAAQQJ2IABBgICAgARJIgAbICYgFSAVQQJqIAAbdWoQGSIHIAVrIgAgAEEfdSIAcyAAayEbQQAhA0EAIQAgCSAmQQF0aiIJQQJxBEBBASEDIAkuAQAiACAAbCEACwJ/A0BBACADICFODQEaIANBAXQhBCADQQJqIQMgACAEIAlqKAIAIgZBEHUiBCAEbGogBsEiACAAbGoiAEEATg0ACyAAQQJ2IQBBAgshFSADICFIBEADQCAAIAkgA0EBdGooAgAiBsEiBCAEbCAGQRB1IgQgBGxqIBV2aiIAQQJ2IAAgAEEASCIEGyEAIBVBAmogFSAEGyEVIANBAmoiAyAhSA0ACwsgAyAhRgRAIAAgCSAhQQF0ai4BACIDIANsIBV2aiEACyAAIABBAnYgAEGAgICABEkiABsgJiAVIBVBAmogABt1ahAZIgUgB2siACAAQR91IgBzIABrIQxBACEDQQAhACAJICZBAXRqIglBAnEEQEEBIQMgCS4BACIAIABsIQALAn8DQEEAIAMgIU4NARogA0EBdCEEIANBAmohAyAAIAQgCWooAgAiBkEQdSIEIARsaiAGwSIAIABsaiIAQQBODQALIABBAnYhAEECCyEVIAMgIUgEQANAIAAgCSADQQF0aigCACIGwSIEIARsIAZBEHUiBCAEbGogFXZqIgBBAnYgACAAQQBIIgQbIQAgFUECaiAVIAQbIRUgA0ECaiIDICFIDQALCyADICFGBEAgACAJICFBAXRqLgEAIgMgA2wgFXZqIQALIAAgAEECdiAAQYCAgIAESSIAGyAmIBUgFUECaiAAG3VqEBkiByAFayIAIABBH3UiAHMgAGshDUEAIQNBACEAIAkgJkEBdGoiCUECcQRAQQEhAyAJLgEAIgAgAGwhAAsCfwNAQQAgAyAhTg0BGiADQQF0IQQgA0ECaiEDIAAgBCAJaigCACIGQRB1IgQgBGxqIAbBIgAgAGxqIgBBAE4NAAsgAEECdiEAQQILIRUgAyAhSARAA0AgACAJIANBAXRqKAIAIgbBIgQgBGwgBkEQdSIEIARsaiAVdmoiAEECdiAAIABBAEgiBBshACAVQQJqIBUgBBshFSADQQJqIgMgIUgNAAsLIAMgIUYEQCAAIAkgIUEBdGouAQAiAyADbCAVdmohAAsgACAAQQJ2IABBgICAgARJIgAbICYgFSAVQQJqIAAbdWoQGSIFIAdrIgAgAEEfdSIAcyAAayEPQQAhA0EAIQAgCSAmQQF0aiIJQQJxBEBBASEDIAkuAQAiACAAbCEACwJ/A0BBACADICFODQEaIANBAXQhBCADQQJqIQMgACAEIAlqKAIAIgZBEHUiBCAEbGogBsEiACAAbGoiAEEATg0ACyAAQQJ2IQBBAgshFSADICFIBEADQCAAIAkgA0EBdGooAgAiBsEiBCAEbCAGQRB1IgQgBGxqIBV2aiIAQQJ2IAAgAEEASCIEGyEAIBVBAmogFSAEGyEVIANBAmoiAyAhSA0ACwsgAyAhRgRAIAAgCSAhQQF0ai4BACIDIANsIBV2aiEACyAAIABBAnYgAEGAgICABEkiABsgJiAVIBVBAmogABt1ahAZIgcgBWsiACAAQR91IgBzIABrIQhBACEDQQAhACAJICZBAXRqIidBAnEEQEEBIQMgJy4BACIAIABsIQALAn8DQEEAIAMgIU4NARogA0EBdCEEIANBAmohAyAAIAQgJ2ooAgAiBkEQdSIEIARsaiAGwSIAIABsaiIAQQBODQALIABBAnYhAEECCyEVIAMgIUgEQANAIAAgJyADQQF0aigCACIGwSIEIARsIAZBEHUiBCAEbGogFXZqIgBBAnYgACAAQQBIIgQbIQAgFUECaiAVIAQbIRUgA0ECaiIDICFIDQALCyADICFGBEAgACAnICFBAXRqLgEAIgMgA2wgFXZqIQALIAAgAEECdiAAQYCAgIAESSIAGyAmIBUgFUECaiAAG3VqEBkiBSAHayIAIABBH3UiAHMgAGshCUEAIQNBACEAICcgJkEBdGoiJ0ECcQRAQQEhAyAnLgEAIgAgAGwhAAsCfwNAQQAgAyAhTg0BGiADQQF0IQQgA0ECaiEDIAAgBCAnaigCACIGQRB1IgQgBGxqIAbBIgAgAGxqIgBBAE4NAAsgAEECdiEAQQILIRUgAyAhSARAA0AgACAnIANBAXRqKAIAIgbBIgQgBGwgBkEQdSIEIARsaiAVdmoiAEECdiAAIABBAEgiBBshACAVQQJqIBUgBBshFSADQQJqIgMgIUgNAAsLIAMgIUYEQCAAICcgIUEBdGouAQAiAyADbCAVdmohAAsgACAAQQJ2IABBgICAgARJIgAbICYgFSAVQQJqIAAbdWoQGSIHIAVrIgAgAEEfdSIAcyAAayEFQQAhA0EAIQAgJyAmQQF0aiInQQJxBEBBASEDICcuAQAiACAAbCEACwJ/A0BBACADICFODQEaIANBAXQhBCADQQJqIQMgACAEICdqKAIAIgZBEHUiBCAEbGogBsEiACAAbGoiAEEATg0ACyAAQQJ2IQBBAgshFSADICFIBEADQCAAICcgA0EBdGooAgAiBsEiBCAEbCAGQRB1IgQgBGxqIBV2aiIAQQJ2IAAgAEEASCIEGyEAIBVBAmogFSAEGyEVIANBAmoiAyAhSA0ACwsgAyAhRgRAIAAgJyAhQQF0ai4BACIAIABsIBV2aiEACyARIBUgFUECaiAAQYCAgIAESSIEGyIDNgLcByARICYgA3UgACAAQQJ2IAQbaiIANgLYByAXQf//A3EgH2xBEHUgImogL2ogFAJ/IAUgCSAIIA8gDSAMIBsgEyAZa2pqampqamogABAZIAdrIgAgAEEfdSIAcyAAa2pBgAVrIgBB//8DcUGaM2xBEHYgAEEQdUGaM2xqIgNBAEgEQEEAIANBwX5JDQEaQQAgA2siA0EDdkH8////AXEiAEGQFmooAgAgAEGwFmouAQAgA0EfcWxrDAELQf//ASADQb8BSw0AGiADQQN2Qfz///8BcSIAQbAWai4BACADQR9xbCAAQdAWaigCAGoLQQd1IgA2AuAEIBQgAEHBAUg2AmQgAEEQdEGAgIAEa0EQdWoLIRhBs+YDIBQoAuQEIgBB//8DcUHCAGxBEHYgAEEQdUHCAGxqIgPBIgAgA0EQdWwgACADQf//A3FsQRB1aiADQQ91QQFqQQF1IANsakGAgARqQRAQICIDIBpBfWwiAEGAgARqQRB1QY8FbCAAQf//A3FBjwVsQRB2aiIAa0EOdCAAIANqIg9BAnVtIQhBACEDICUgK0EBdGshNSAOKAKkdyIAQQBKBEAgACAjQRF1Qb0UbGogKEH//wNxQb0UbEEQdmohAwsgA8EiHUEAIANrIgBBEHVsIB0gAEH//wNxbEEQdWpBgIAEaiE2IAhB//8DcSEhIAhBEHUhJiAPQf//A3EhJyAPQRB1ISggFEH8AmohKiAUQfwBaiEwIBRBjARqIS8gFEGAAWohK0EAIANBEHRrQRB1ITEgAMEhLCARQaQIaiEjIBFBsAhqIgBBCHIhGiAAQQRyIRYgEUECciEfIBFBzAVqIRcgHf0RITsDQCARIDVBASAOKALgdiIpIA4oAsh2IgNBBWwiBGsiAEEBdSIGECkgA0EKbCIDBEAgESAAQX5xIgBqIAAgNWogA/wKAAALIBEgBCAGakEBdCIAaiAAIDVqQQIgBhApIA4oAtR2IA4oAoB3IQYCQCAOKAKkd0EASgRAIBFB4AdqIgNBAEHEAPwLACARQbAIaiIAQQBBiAH8CwBBECENIBFBGUE3QQ0CfwJAAkAgKUEATA0AIAZBA3QgAGohIiAGQQJ0IANqIRlBACEVQQAhCgJAIAZBAEoEQANAIBEgCkEBdGouAQBBDnQhAEEAIQMDQCARQeAHaiITIANBAXIiCUECdGoiBygCACEMIANBAnQgE2ogADYCACARQbAIaiIFIANBA3RqIgQgBCkDACARNALgByJOIACsfkISh3w3AwAgDCAAayIEQRB1IB1sIBVqIQAgA0ECaiIDQQJ0IBNqKAIAIRUgByAAIARB//8DcSAdbEEQdWoiBDYCACAJQQN0IAVqIgAgACkDACBOIASsfkISh3w3AwAgDCAVIARrIgBBEHUgHWxqIABB//8DcSAdbEEQdWohACADIAZIDQALIBkgADYCACAiICIpAwAgESgC4AciFawgAKx+QhKHfDcDACAKQQFqIgogKUcNAAwCCwALICIpAwAhT0EAIQMCQCApQQFHBEAgKUEBcSApQf7///8HcSEFA0AgGSARIANBAXQiAGouAQBBDnQiBDYCACARNALgByAZIAAgH2ouAQBBDnQiADYCACAErH5CEocgT3wgETQC4AcgAKx+QhKHfCFPIANBAmoiAyAFRw0AC0UNAQsgGSARIANBAXRqLgEAQQ50IgA2AgAgETQC4AcgAKx+QhKHIE98IU8LICIgTzcDAAsgESkDsAgiTkL/////D1YNASBOQoCABFoEQCBOQhCIpyEAAn8gTkKAgIAIWgRAIE5CgICAgAFaBEAgAMFBDHUhA0EADAILIABBgP4DcUEIdiEDQQQMAQsgACAAQfD/A3FBBHYgTkKAgMAAVCIAGyEDQQxBCCAAGwshACAAIANBCHFFckEgaiADQQxxDQMaIABBAnJBIGogA0ECcQ0DGiAAQQNyQSBqDAMLIE5QDQAgTqchAAJ/IE5CgAJaBEAgTkKAIFoEQCAAwUEMdSEDQQAMAgsgAEGA/gNxQQh2IQNBBAwBCyAAIABB8P8DcUEEdiBOQhBUIgAbIQNBDEEIIAAbCyEAIANBDHEEQCAAIANBCHFFciENDAELIANBAnEEQCAAQQJyIQ0MAQsgAEEDciENCyANQTBqDAELIE5CgICAgICAwABaBEAgTkIwiKchAAJ/IE5CgICAgICAgIABWgRAIE5CgICAgICAgIAQWgRAIADBQQx1IQNBAAwCCyAAQQh2IQNBBAwBCyAAIABBBHYgTkKAgICAgICACFQiABshA0EMQQggABsLIQAgACADQQhxRXIgA0EMcQ0BGiAAQQJyIANBAnENARogAEEDcgwBCyBOQiCIpyEAAn8gTkKAgICAgCBaBEAgTkKAgICAgIAEWgRAIADBQQx1IQNBEAwCCyAAQYD+A3FBCHYhA0EUDAELIAAgAEHw/wNxQQR2IE5CgICAgIACVCIAGyEDQRxBGCAAGwsgA0EMcQR/IANBCHFFBUECQQMgA0ECcRsLcgsiAyADQQ1NGyIAIABBN08bIgBrNgLcByADQSJNBEAgBkEASA0CQSMgAGutIU4CQCAGRQRAQQAhAwwBCyAGQQFqIgRBfnEhA0EAIQADQCARQZAHaiAAQQJ0aiARQbAIaiAAQQN0av0ABAAgTqf9zAEgPP0NAAECAwgJCgsAAQIDAAECA/1bAwAAIABBAmoiACADRw0ACyADIARGDQMLA0AgEUGQB2ogA0ECdGogEUGwCGogA0EDdGopAwAgToc+AgAgAyAGRyADQQFqIQMNAAsMAgsgBkEASA0BIABBI2utIU4CQCAGRQRAQQAhAwwBCyAGQQFqIgRBfnEhA0EAIQADQCARQZAHaiAAQQJ0aiARQbAIaiAAQQN0av0ABAAgTqf9ywEgPP0NAAECAwgJCgsAAQIDAAECA/1bAwAAIABBAmoiACADRw0ACyADIARGDQILA0AgEUGQB2ogA0ECdGogEUGwCGogA0EDdGopAwAgToY+AgAgAyAGRiADQQFqIQNFDQALDAELIBFBkAdqIBFB3AdqIBEgKSAGQQFqEDkLIBFBASARKAKQByIDQQR2Qf//A3FBCmxBEHYgA0EUdUEKbGoiACAAQQFMGyADaiIANgKQBwJAAkACQCAAQQBKBEAgBkEASA0CQQAhAwJAIAZBAksEQCAGQQFqIgVBfHEhA0EAIQADQCARQbAIaiAAQQN0aiIEIBFBkAdqIABBAnRq/QAEACI8IDz9DQgJCgsICQoLDA0ODwwNDg/9CwQQIAQgPCA8/Q0AAQIDAAECAwQFBgcEBQYH/QsEACAAQQRqIgAgA0cNAAsgAyAFRg0BCwNAIBFBsAhqIANBA3RqIgQgEUGQB2ogA0ECdGooAgAiADYCBCAEIAA2AgAgAyAGRiADQQFqIQNFDQALIAZFDQMLQQAhDSAWIBYgBkEDdGpJIQkgBiEMDAELQQAhDCAGQQJ0IgBFDQIgEUHQBmpBACAA/AsADAILA0AgESgCtAghBUEAIBFBsAhqIA0iBEEBaiINQQN0aigCACIDawJ/IAMgA0EfdSIAcyAAayIHQYCABE8EQCAHQRB2IQACfyAHQYCAgAhPBEAgB0GAgICAAU8EQCAAQQx2IQBBAAwCCyAAQQh2IQBBBAwBCyAAIABBBHYgB0GAgMAASSIDGyEAQQxBCCADGwshAyADIABBCHFFciAAQQxxDQEaIANBAnIgAEECcQ0BGiADQQNyDAELAn9BECADRQ0AGgJ/IAdBgAJPBEAgB0GAIE8EQCAHwUEMdSEAQQAMAgsgB0GA/gNxQQh2IQBBBAwBCyAHIAdB8P8DcUEEdiAHQRBJIgMbIQBBDEEIIAMbCyEDIAMgAEEIcUVyIABBDHENABogA0ECciAAQQJxDQAaIANBA3ILQRBqCyIHQQFrdCIDQf////8BIAUCfyAFIAVBH3UiAHMgAGsiE0GAgARPBEAgE0EQdiEAAn8gE0GAgIAITwRAIBNBgICAgAFPBEAgAEEMdiEFQQAMAgsgAEEIdiEFQQQMAQsgACAAQQR2IBNBgIDAAEkiABshBUEMQQggABsLIQAgACAFQQhxRXIgBUEMcQ0BGiAAQQJyIAVBAnENARogAEEDcgwBCwJ/QRAgBUUNABoCfyATQYACTwRAIBNBgCBPBEAgE8FBDHUhBUEADAILIBNBgP4DcUEIdiEFQQQMAQsgEyATQfD/A3FBBHYgE0EQSSIAGyEFQQxBCCAAGwshACAAIAVBCHFFciAFQQxxDQAaIABBAnIgBUECcQ0AGiAAQQNyC0EQagsiBUEBa3QiAEEQdW3BIhMgA0H//wNxbEEQdSATIANBEHVsaiIDrCAArH5CHYinQXhxayIAQRB1IBNsIANqIABB//8DcSATbEEQdWohEyARQdAGaiAEQQJ0agJ/IAcgBWsiAEECTARAQf////8HQQIgAGsiBXYiAyATQYCAgIB4IAV1IgAgACATSBsgAyATSBsgBXQMAQsgEyAAQQJrdQsiAEEOdUEBakEBdTYCACAEIAZIBEAgAKwhTkEAIQMCQCAMQQVJDQAgGiAEQQN0aiARQbAIaiAGIARrQQN0akkgCXENACAMIAxBA3EiAEEEIAAbayEDIE79EiE8IA39ESE//QwAAAAAAQAAAAIAAAADAAAAITpBACEVA0AgEUGwCGoiBSA/IDr9rgEiQv0bAEEDdGoiACAA/QADACAA/QADEP0NAAECAwgJCgsQERITGBkaGyJAIDwgFUEDdCAFaiIE/QACBCAEQRRqIgD9AAIA/Q0AAQIDCAkKCxAREhMYGRobIj5BAf2rASI5/ccB/dUBQSD9zQEgPCA5/cgB/dUBQSD9zQH9DQABAgMICQoLEBESExgZGhv9rgEiOf1aAgAAIEL9GwFBA3QgBWogOf1aAgABIEL9GwJBA3QgBWogOf1aAgACIEL9GwNBA3QgBWogOf1aAgADIARBDGogPiA8IEBBAf2rASI5/ccB/dUBQSD9zQEgPCA5/cgB/dUBQSD9zQH9DQABAgMICQoLEBESExgZGhv9rgEiOf1aAgABIAQgOf1aAgQAIAAgOf1aAgACIARBHGogOf1aAgADIDr9DAQAAAAEAAAABAAAAAQAAAD9rgEhOiAVQQRqIhUgA0cNAAsLA0AgEUGwCGoiBCADIA1qQQN0aiIAIAAoAgAiBSADQQN0IARqIgQoAgQiAEEBdKwgTn5CIIinajYCACAEIAAgBUEBdKwgTn5CIIinajYCBCADQQFqIgMgDEcNAAsLIAxBAWshDCAGIA1HDQALCyARKAK0CCEMCyARIAw2AtgHIAZBAEoEQEEAIQAgESgC0AYhBCARQdAFaiARQdAGaiAGQQJ0akkhDQNAIAQhBwJAIABFDQAgAEECdCIJBEAgEUGwCGogEUHQBWogCfwKAAALIBFB0AZqIgUgCWooAgAhB0EAIQMCQCAAQQRJDQAgDSARQdAFaiAJaiAFS3ENACAAQfz///8HcSEDIAf9EUEQ/asBQRD9rAEhOiAHQQ91QQFq/RFBAf2sASE5QQAhFQNAIBFB0AVqIBVBAnRqIgUgOiAjIAAgFUF/c2pBAnRq/QACACA8/Q0MDQ4PCAkKCwQFBgcAAQIDIjxBEP2sAf21ASAF/QAEAP2uASA6IDz9DP//AAD//wAA//8AAP//AAD9Tv21AUEQ/awB/a4BIDkgPP21Af2uAf0LBAAgFUEEaiIVIANHDQALIAAgA0YNAQsgB0EPdUEBakEBdSEJIAfBIRMDQCARQdAFaiADQQJ0aiIFIAUoAgAgEyARQbAIaiAAIANBf3NqQQJ0aigCACIFQRB1bGogEyAFQf//A3FsQRB1aiAFIAlsajYCACADQQFqIgMgAEcNAAsLIBFB0AVqIABBAnRqQQAgB0EIdGs2AgAgAEEBaiIAIAZHDQALC0EAIBEoAtwHIgNrIgBBAXEEQCARIAxBAXUiDDYC2AcgA0F/cyEACyArIDdBAnQiCWoiBSAMQQBMBH9BAAUCfwJAAkAgDEGAgARPBEAgDEEQdiEDAn8gDEGAgIAITwRAIAxBgICAgAFPBEAgA0EMdiEDQQAMAgsgA0EIdiEDQQQMAQsgAyADQQR2IAxBgIDAAEkiBBshA0EMQQggBBsLIQQgA0EMcUUNASADQQhxRSAEciEDDAILAn8gDEGAAk8EQCAMQYAgTwRAIAzBQQx1IQNBAAwCCyAMQYD+A3FBCHYhA0EEDAELIAwgDEHw/wNxQQR2IAxBEEkiBBshA0EMQQggBBsLIANBDHEEfyADQQhxRQVBAkEDIANBAnEbC3IiBEEQciIDQRhJDQEgDCAEQQhrdAwCC0ECQQMgA0ECcRsgBHIhAwsgDCADQQhqdwshBEGAgAJBhukCIANBAXEbIANBAXZ2IgMgBEH/AHFsQdUBbEEQdiADagsiBEH/////B0EQIABBAXVrIgN2IgAgACAESxsgA3QiBzYCACAOKAKkd0EASgRAIBcgDigCgHciA0ECdGooAgAhAAJAIANBAkgNACADQQJrIQQgA0EBcQR/IAQFIBFB0AVqIARBAnRqKAIAIABBEHUgMWxqIABB//8DcSAxbEEQdWohACADQQNrCyEDIARFDQADQCARQdAFaiIGIANBAWsiBEECdGooAgAgA0ECdCAGaigCACAAQRB1IDFsaiAAQf//A3EgMWxBEHVqIgBBEHUgMWxqIABB//8DcSAxbEEQdWohACADQQJrIQMgBA0ACwsCfyAAQRB1IB1sIABB//8DcSAdbEEQdWpBgICACGoiBCAEQR91IgBzIABrIgNBgIAETwRAIANBEHYhAAJ/IANBgICACE8EQCADQYCAgIABTwRAIABBDHYhA0EADAILIABBCHYhA0EEDAELIAAgAEEEdiADQYCAwABJIgAbIQNBDEEIIAAbCyEAIAAgA0EIcUVyIANBDHENARogAEECciADQQJxDQEaIABBA3IMAQsCf0EQIARFDQAaAn8gA0GAAk8EQCADQYAgTwRAIAPBQQx1IQNBAAwCCyADQYD+A3FBCHYhA0EEDAELIAMgA0Hw/wNxQQR2IANBEEkiABshA0EMQQggABsLIQAgACADQQhxRXIgA0EMcQ0AGiAAQQJyIANBAnENABogAEEDcgtBEGoLIQ1BACAEIA1BAWt0IgBB//8DcUH/////ASAAQRB1IgBtIgPBIgRsQRB1IAAgBGxqQQN0ayIAIANBD3VBAWpBAXVsIANBEHRqIABBEHUgBGxqIABB+P8DcSAEbEEQdWohBiAFQf////8HAn8gDUEWTwRAQf////8HIA1BFmsiBHYiAyAGQYCAgIB4IAR1IgAgACAGSBsgAyAGSBsgBHQMAQsgBkEWIA1rdQsiA8EiACAHQf//A3FsQRB1IAAgB0EQdWxqIANBD3VBAWpBAXUgB2xqIgAgAEH/////B08bNgIACyAOKAKAdyIMQQFrIQ1BACEVIA8hACAMQQJIIgdFBEADQCARQdAFaiAVQQJ0aiIDIADBIgQgAygCACIDQRB1bCADIABBD3VBAWpBAXUiAGxqIANB//8DcSAEbEEQdWo2AgAgBCAobCAEICdsQRB1aiAAIA9saiEAIBVBAWoiFSANRw0ACwsgDUECdCIFIBFB0AVqIgZqIgQgAMEiAyAEKAIAIgRBEHVsIAQgAEEPdUEBakEBdWxqIARB//8DcSADbEEQdWo2AgAgDEECdCIABEAgEUGQBmogBiAA/AoAAAtBACEVIAghACAHRQRAA0AgEUGQBmogFUECdGoiAyAAwSIEIAMoAgAiA0EQdWwgAyAAQQ91QQFqQQF1IgBsaiADQf//A3EgBGxBEHVqNgIAIAQgJmwgBCAhbEEQdWogACAIbGohACAVQQFqIhUgDUcNAAsLIBFBkAZqIAVqIgQgAMEiAyAEKAIAIgRBEHVsIAQgAEEPdUEBakEBdWxqIARB//8DcSADbEEQdWo2AgACQAJAAkACQCAMQQBKBEAgDEEBcUEGdCIFIBFBsAhqaiEAQQAhAyAMQQRJIgYNASAMQfz///8HcSEDQQAhFQNAIAAgFUECdCIEaiARQdAFaiAEav0ABABBB/2sASI8/QwBAAAAAQAAAAEAAAABAAAA/U4gPP0MAQAAAAEAAAABAAAAAQAAAP1RQQH9rAH9rgH9CwQAIBVBBGoiFSADRw0ACyADIAxHDQEgEUHUB2ogEUGwCGogDBAbGgwCCyARQdQHaiARQbAIaiAMEBsaDAMLA0AgACADQQJ0IgRqIBFB0AVqIARqKAIAQQd1QQFqQQF1NgIAIANBAWoiAyAMRw0ACyARQdQHaiARQbAIaiIAIAwQGxogACAFaiEAQQAhAyAGDQELIAxB/P///wdxIQNBACEVA0AgACAVQQJ0IgRqIBFBkAZqIARq/QAEAEEH/awBIjz9DAEAAAABAAAAAQAAAAEAAAD9TiA8/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uAf0LBAAgFUEEaiIVIANHDQALIAMgDEYNAQsDQCAAIANBAnQiBGogEUGQBmogBGooAgBBB3VBAWpBAXU2AgAgA0EBaiIDIAxHDQALCyARQdgHaiARQbAIaiAMEBsaIBEgESgC1AciAEH//wNxQZqzAWxBEHYgAEEQdUGaswFsakEBdCIANgLUByAJIC9qIAAgESgC2AdBDhAgQbMmajYCACAOKAKAdyIeQQFrIQYgHkECSCIgRQRAIAZBAnQiACARQZAGamooAgAhAyARQdAFaiAAaigCACEAIAYhBQNAIAVBAWsiBEECdCIJIBFB0AVqaiIHIAcoAgAgAEEQdSAsbGogAEH//wNxICxsQRB1aiIANgIAIBFBkAZqIAlqIgcgBygCACADQRB1ICxsaiADQf//A3EgLGxBEHVqIgM2AgAgBUEBSyAEIQUNAAsLQQF0IDYgESgC0AUiAEEQdSAdbCAAQf//A3EgHWxBEHVqQYCAgAhqQRgQICEHIDYgESgCkAYiAEEQdSAdbCAAQf//A3EgHWxBEHVqQYCAgAhqQRgQICEKAkAgHkEATA0AIApB//8DcSEbIApBEHUhDCAHQf//A3EhDSAHQRB1IQlBACEEAkAgHkEDSwRAIB5B/P///wdxIQQgCv0RIUMgB/0RIT0gG/0RIUIgDP0RIT8gDf0RIUAgCf0RIT5BACEDA0AgA0ECdCIFIBFB0AVqaiIAIAD9AAQAIjpBEP2rAUEQ/awBIjkgQP21AUEQ/awBIDkgPv21Af2uASA6QQ/9rAEiOf0MAQAAAAEAAAABAAAAAQAAACI8/U4gOf0MAQAAAAEAAAABAAAAAQAAAP1RQQH9rAH9rgEgPf21Af2uAf0LBAAgEUGQBmogBWoiACAA/QAEACI6QRD9qwFBEP2sASI5IEL9tQFBEP2sASA5ID/9tQH9rgEgOkEP/awBIjn9DAEAAAABAAAAAQAAAAEAAAD9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uASBD/bUB/a4B/QsEACADQQRqIgMgBEcNAAsgBCAeRg0BCwNAIARBAnQiBSARQdAFamoiACAAKAIAIgPBIgAgDWxBEHUgACAJbGogA0EPdUEBakEBdSAHbGo2AgAgEUGQBmogBWoiACAAKAIAIgPBIgAgG2xBEHUgACAMbGogA0EPdUEBakEBdSAKbGo2AgAgBEEBaiIEIB5HDQALIB5B/P///wdxIQQLIAZBfHEiLkEBciEJIAZBAnQiACARQZAGamohJCARQdAFaiAAaiEtQQAhBUEAITQDQEF/IQBBACEDA0AgA0ECdCIbIBFB0AVqaigCACINIA1BH3UiDXMgDWsiDCARQZAGaiAbaigCACINIA1BH3UiDXMgDWsiDSAMIA1LGyINIAAgACANSCINGyEAIAMgBSANGyEFIANBAWoiAyAeRw0ACyAAQfj8/h9PBEACQCAgDQBBASEDIBEoApAGIQwgESgC0AUhDSAeQQVPBEAgDf0RITkgDP0RITpBACEDA0AgA0ECdCIbIBFB0AVqIg1qIA0gG0EEciIMav0AAgAiPEEQ/awBIDv9tQEgOSA8/Q0MDQ4PEBESExQVFhcYGRob/a4BIDz9DP//AAD//wAA//8AAP//AAD9TiA7/bUBQRD9rAH9rgH9CwQAIBsgEUGQBmoiDWogDCANav0AAgAiOUEQ/awBIDv9tQEgOiA5/Q0MDQ4PEBESExQVFhcYGRob/a4BIDn9DP//AAD//wAA//8AAP//AAD9TiA7/bUBQRD9rAH9rgH9CwQAIDkhOiA8ITkgA0EEaiIDIC5HDQALIAYgLkYNASA5/RsDIQ0gOv0bAyEMIAkhAwsDQCADQQJ0IhlBBGsiEyARQdAFaiIbaiANIBkgG2ooAgAiDUEQdSAdbGogDUH//wNxIB1sQRB1ajYCACATIBFBkAZqIhtqIAwgGSAbaigCACIMQRB1IB1saiAMQf//A3EgHWxBEHVqNgIAIANBAWoiAyAeRw0ACwtBACAHAn8gByAHQR91IgNzIANrIg1BgIAETwRAIA1BEHYhAwJ/IA1BgICACE8EQCANQYCAgIABTwRAIANBDHYhA0EADAILIANBCHYhA0EEDAELIAMgA0EEdiANQYCAwABJIgcbIQNBDEEIIAcbCyEHIAcgA0EIcUVyIANBDHENARogB0ECciADQQJxDQEaIAdBA3IMAQsCf0EQIAdFDQAaAn8gDUGAAk8EQCANQYAgTwRAIA3BQQx1IQNBAAwCCyANQYD+A3FBCHYhA0EEDAELIA0gDUHw/wNxQQR2IA1BEEkiBxshA0EMQQggBxsLIQcgByADQQhxRXIgA0EMcQ0AGiAHQQJyIANBAnENABogB0EDcgtBEGoLIgxBAWt0IgNB//8DcUH/////ASADQRB1IgNtIgfBIg1sQRB1IAMgDWxqQQN0ayIDIAdBD3VBAWpBAXVsIAdBEHRqIANBEHUgDWxqIANB+P8DcSANbEEQdWohGwJ/IAxBHk8EQEH/////ByAMQR5rIg12IgcgG0GAgICAeCANdSIDIAMgG0gbIAcgG0gbIA10DAELIBtBHiAMa3ULITJBACAKAn8gCiAKQR91IgNzIANrIgdBgIAETwRAIAdBEHYhAwJ/IAdBgICACE8EQCAHQYCAgIABTwRAIANBDHYhA0EADAILIANBCHYhA0EEDAELIAMgA0EEdiAHQYCAwABJIgcbIQNBDEEIIAcbCyEHIAcgA0EIcUVyIANBDHENARogB0ECciADQQJxDQEaIAdBA3IMAQsCf0EQIApFDQAaAn8gB0GAAk8EQCAHQYAgTwRAIAfBQQx1IQNBAAwCCyAHQYD+A3FBCHYhA0EEDAELIAcgB0Hw/wNxQQR2IAdBEEkiBxshA0EMQQggBxsLIQcgByADQQhxRXIgA0EMcQ0AGiAHQQJyIANBAnENABogB0EDcgtBEGoLIgxBAWt0IgNB//8DcUH/////ASADQRB1IgNtIgfBIg1sQRB1IAMgDWxqQQN0ayIDIAdBD3VBAWpBAXVsIAdBEHRqIANBEHUgDWxqIANB+P8DcSANbEEQdWohGwJ/IAxBHk8EQEH/////ByAMQR5rIg12IgcgG0GAgICAeCANdSIDIAMgG0gbIAcgG0gbIA10DAELIBtBHiAMa3ULIgpB//8DcSEVIApBEHUhKSAyQf//A3EhEyAyQRB1IRtBACEDAkAgHkEESSIZRQRAIDL9ESFDIBX9ESE9ICn9ESFCIBP9ESE/IBv9ESFAIAr9ESE+A0AgA0ECdCINIBFB0AVqaiIHIAf9AAQAIjpBEP2rAUEQ/awBIjkgP/21AUEQ/awBIDkgQP21Af2uASA6QQ/9rAEiOf0MAQAAAAEAAAABAAAAAQAAACI8/U4gOf0MAQAAAAEAAAABAAAAAQAAAP1RQQH9rAH9rgEgQ/21Af2uAf0LBAAgEUGQBmogDWoiByAH/QAEACI6QRD9qwFBEP2sASI5ID39tQFBEP2sASA5IEL9tQH9rgEgOkEP/awBIjn9DAEAAAABAAAAAQAAAAEAAAD9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uASA+/bUB/a4B/QsEACADQQRqIgMgBEcNAAsgHiAEIgNGDQELA0AgA0ECdCIMIBFB0AVqaiIHIAcoAgAiDcEiByATbEEQdSAHIBtsaiANQQ91QQFqQQF1IDJsajYCACARQZAGaiAMaiIHIAcoAgAiDcEiByAVbEEQdSAHIClsaiANQQ91QQFqQQF1IApsajYCACADQQFqIgMgHkcNAAsLQfH6AyA0QeYAbEGzBmoiByAAQff8/h9rIgNB//8DcWxBEHYgA0EQdiAHbGogBUEBaiAAbEEWECBrIgMhACAeQQFGIhNFBEAgA0H//wNxIRsgA0EQdSEMQQAhDQNAIBFB0AVqIA1BAnRqIgcgAMEiKSAHKAIAIgdBEHVsIAcgAEEPdUEBakEBdSIAbGogB0H//wNxIClsQRB1ajYCACAMIClsIBsgKWxBEHVqIAAgA2xqIQAgDUEBaiINIAZHDQALCyAtIADBIgcgLSgCACINQRB1bCANIABBD3VBAWpBAXVsaiANQf//A3EgB2xBEHVqIg02AgACQCATBEAgAyEADAELIANB//8DcSETIANBEHUhG0EAIQwgAyEAA0AgEUGQBmogDEECdGoiByAAwSIpIAcoAgAiB0EQdWwgByAAQQ91QQFqQQF1IgBsaiAHQf//A3EgKWxBEHVqNgIAIBsgKWwgEyApbEEQdWogACADbGohACAMQQFqIgwgBkcNAAsLICQgAMEiAyAkKAIAIgdBEHVsIAcgAEEPdUEBakEBdWxqIAdB//8DcSADbEEQdWoiAzYCACAGIQAgIEUEQANAIABBAWsiB0ECdCIbIBFB0AVqaiIMIAwoAgAgDUEQdSAsbGogDUH//wNxICxsQRB1aiINNgIAIBFBkAZqIBtqIgwgDCgCACADQRB1ICxsaiADQf//A3EgLGxBEHVqIgM2AgAgAEEBSyAHIQANAAsLIDYgESgC0AUiAEEQdSAdbCAAQf//A3EgHWxBEHVqQYCAgAhqQRgQICIHQf//A3EhFSAHQRB1ISkgNiARKAKQBiIAQRB1IB1sIABB//8DcSAdbEEQdWpBgICACGpBGBAgIgpB//8DcSETIApBEHUhG0EAIQMCQCAZRQRAIBP9ESFDIBv9ESE9IBX9ESFCICn9ESE/IAr9ESFAIAf9ESE+A0AgA0ECdCINIBFB0AVqaiIAIAD9AAQAIjpBEP2rAUEQ/awBIjkgQv21AUEQ/awBIDkgP/21Af2uASA6QQ/9rAEiOf0MAQAAAAEAAAABAAAAAQAAACI8/U4gOf0MAQAAAAEAAAABAAAAAQAAAP1RQQH9rAH9rgEgPv21Af2uAf0LBAAgEUGQBmogDWoiACAA/QAEACI6QRD9qwFBEP2sASI5IEP9tQFBEP2sASA5ID39tQH9rgEgOkEP/awBIjn9DAEAAAABAAAAAQAAAAEAAAD9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uASBA/bUB/a4B/QsEACADQQRqIgMgBEcNAAsgHiAEIgNGDQELA0AgA0ECdCIMIBFB0AVqaiIAIAAoAgAiDcEiACAVbEEQdSAAIClsaiANQQ91QQFqQQF1IAdsajYCACARQZAGaiAMaiIAIAAoAgAiDcEiACATbEEQdSAAIBtsaiANQQ91QQFqQQF1IApsajYCACADQQFqIgMgHkcNAAsLIDRBAWoiNEEKRw0BCwsgN0EEdCEFQQAhAyAeQQRPBEADQCAwIAMgBWpBAXQiBmogA0ECdCIAIBFBkAZqav0ABABBCv2sASI5/QwBAAAAAQAAAAEAAAABAAAAIjz9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uAf0MAID//wCA//8AgP//AID///24Af0M/38AAP9/AAD/fwAA/38AAP22Af0MAQAAAAEAAAABAAAAAQAAAP0NAAEEBQgJDA0AAQABAAEAAf1bAQAAIAYgKmogEUHQBWogAGr9AAQAQQr9rAEiOf0MAQAAAAEAAAABAAAAAQAAAP1OIDn9DAEAAAABAAAAAQAAAAEAAAD9UUEB/awB/a4B/QwAgP//AID//wCA//8AgP///bgB/Qz/fwAA/38AAP9/AAD/fwAA/bYB/QwBAAAAAQAAAAEAAAABAAAA/Q0AAQQFCAkMDQABAAEAAQAB/VsBAAAgA0EEaiIDIARHDQALIB4gBCIDRg0BCwNAIDAgAyAFakEBdCIGakH//wFBgIB+IANBAnQiBCARQZAGamooAgBBCnVBAWpBAXUiACAAQYCAfkwbIgAgAEH//wFOGzsBACAGICpqQf//AUGAgH4gEUHQBWogBGooAgBBCnVBAWpBAXUiACAAQYCAfkwbIgAgAEH//wFOGzsBACADQQFqIgMgHkcNAAsLIDVqITUgN0EBaiI3QQRHDQALIA4oAoizASEEIBRB/////wcCf0EAIBhBEHVBiq5/bCAYQf//A3FB9tEAbEEQdmtBgBBqIgZBAEgNABpB/////wcgBkH/HksNABogBkH/AHEhBUEBIAZBB3YiAHQhAyAGQf8PTQR/IAVBgAEgBWtsQdJ+bEEQdSAFaiAAdEEHdQUgBUGAASAFa2xB0n5sQRB1IAVqIANBB3ZsCyADagsiAMEiByAUKAKEASIDQRB1bCADIABBD3VBAWpBAXUiBWxqIANB//8DcSAHbEEQdWoiACAAQf////8HTxs2AoQBIBRB/////wcgFCgCiAEiAEEQdSAHbCAAIAVsaiAAQf//A3EgB2xBEHVqIgAgAEH/////B08bNgKIASAUQf////8HIBQoAowBIgBBEHUgB2wgACAFbGogAEH//wNxIAdsQRB1aiIAIABB/////wdPGzYCjAEgFEH/////ByAEQQh2Qf8BcSAEQQh1IgRBgH5xciIDQYCYBmoiAEH/////ByAAIARBAE4bIANB/+d5ShsiBkH/////ByAUKAKAASIAQRB1IAdsIAAgBWxqIABB//8DcSAHbEEQdWoiACAAQf////8HTxtqIgAgAEEASBsiADYCgAEgDgJ/IA4oApSzAUEQdEECdUGAgAJqQRB1IgMgACAOKAKIswEiBGsiAEH//wNxbEEQdSADIABBEHVsaiIDIARqIgBBAE4EQEGAgICAeCAAIAMgBHFBAEgbDAELQf////8HIAAgAyAEckEAThsLNgKIswEgFEH/////ByAUKAKEASAGaiIAIABBAEgbIgA2AoQBIA4CfyAOKAKUswFBEHRBAnVBgIACakEQdSIDIAAgDigCiLMBIgRrIgBB//8DcWxBEHUgAyAAQRB1bGoiAyAEaiIAQQBIBEBB/////wcgACADIARyQQBOGwwBC0GAgICAeCAAIAMgBHFBAEgbCzYCiLMBIBRB/////wcgFCgCiAEgBmoiACAAQQBIGyIANgKIASAOAn8gDigClLMBQRB0QQJ1QYCAAmpBEHUiAyAAIA4oAoizASIEayIAQf//A3FsQRB1IAMgAEEQdWxqIgMgBGoiAEEASARAQf////8HIAAgAyAEckEAThsMAQtBgICAgHggACADIARxQQBIGws2AoizASAUQf////8HIBQoAowBIAZqIgAgAEEASBsiADYCjAEgDgJ/IA4oApSzAUEQdCIEQQJ1QYCAAmpBEHUiAyAAIA4oAoizASIGayIAQf//A3FsQRB1IAMgAEEQdWxqIgMgBmoiAEEASARAQf////8HIAAgAyAGckEAThsMAQtBgICAgHggACADIAZxQQBIGws2AoizASAUKALUBCIIQZoDbEGz5swBakEJdUEBakEBdSIJQYCABGohACAUKAJoIQMCQCAUKAL8BCIFQQBKDQAgA0EBRw0AQa9/IQxB0QAhB0EBIQMCQAJAIA4oAsh2QRBrDgkAAgICAgICAgECC0FYIQxBKCEHCwJ/QQBBgICACCAUKALgBEEQdGtBEHUgBEEQdWwiBsEiBEEAIAVrIgVB//8DcWxBEHUgBCAFQRB2bGogBkEPdUEBakEBdSAFbGoiBEEQdSAMbCAEQf//A3EgB2xBEHZrQYAQaiIFQQBIDQAaQf////8HIAVB/x5LDQAaIAVB/wBxIQdBASAFQQd2IgR0IQYgBUH/D00EfyAHQYABIAdrbEHSfmxBEHUgB2ogBHRBB3UFIAdBgAEgB2tsQdJ+bEEQdSAHaiAGQQd2bAsgBmoLIgbBIgQgCUH//wNxbEEQdSAEIABBEHVsaiAGQQ91QQFqQQF1IABsaiEACyAUIBT9AAKMBEEQ/asBQRD9rAEiOSAAQf//A3H9Ef21AUEQ/awBIDkgAEEQdf0R/bUB/a4B/QsCjAQgFC4B7ARBgIB+c0EDbCIGQYCADGohBCAOKALIdiEAIA4CfyADBEAgFEGzpgEgAG0iA0GAgANqQf//A3EgA0GaswJsQRB1IgAgBkH//wNxbCAAIARBEHZsIANqQRB0akGAgHxxa0GAgICABGoiADYCiAQgFCAANgKEBCAUIAA2AoAEIBQgADYC/AMgFCgC0AQhFSAOKAL8sgEhBUGz5n4hA0EADAELIBRBgIADIBT9AAJsIjn9GwBt/RFBgIADIDn9GwFt/RwBQYCAAyA5/RsCbf0cAkGAgAMgOf0bA239HANBzRkgAG39Ef2uASI5/QwAwAAAAMAAAADAAAAAwAAA/a4B/Qz//wAA//8AAP//AAD//wAA/U4gOUEQ/asBQRD9rAEgBkH//wNx/RH9tQEgOSAEQRB2QQFq/RH9tQFBEP2rAf2uAf0MAAD//wAA//8AAP//AAD///1O/bEB/QwAAABAAAAAQAAAAEAAAABA/a4B/QsC/ANBgIAEIBQoAtAEIhXBIgNBgIAQIAhBBHRrIgBBEHVsIAMgAEHw/wNxbEEQdWprIgBB//8DcUGz5gBsQRB2IABBEHVBs+YAbGpBAXRBmrMCaiEGIA4oApSzASIAwUGaswJsIABBgIDkAmxqQRB1QbPmAmxBEHUhBAJ/IA4oAvyyASIFQQ90IgdBAEwEQEEAIQpBAAwBC0EQIQNBECEKIAdBgIAETwRAIAdBEHYhAAJ/IAdBgICACE8EQCAHQYCAgIABTwRAIABBDHYhCkEADAILIABBCHYhCkEEDAELIAAgAEEEdiAHQYCAwABJIgAbIQpBDEEIIAAbCyEAIApBDHEEfyAKQQhxRQVBAkEDIApBAnEbCyAAciEKCyAGQRB1IAdBGCAKa3ZB/wBxQdUBbEGAgARyQYCAAkGG6QIgCkEBcRsgCkEBdnZsQRB1bCEKIAdBgIAETwRAIAdBEHYhAAJ/IAdBgICACE8EQCAHQYCAgIABTwRAIABBDHYhA0EADAILIABBCHYhA0EEDAELIAAgAEEEdiAHQYCAwABJIgAbIQNBDEEIIAAbCyEAIANBDHEEfyADQQhxRQVBAkEDIANBAnEbCyAAciEDCyAHQRggA2t2Qf8AcUHVAWxBgIAEckGAgAJBhukCIANBAXEbIANBAXZ2bEEQdQtBs+Z+IARrIQMgBkH+/wNxbEEQdSAKagsiByAOKALcmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2ajYC3JgBIA4gAyAOKALgmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2ajYC4JgBIA4gBcEiBEGAgAggCEEDdGsiAEH4/wNxbEEQdSAAQRB1IARsaiIEQf//A3FBmjNsQRB2QYCABCAVQQJ0ayIAQfz/A3FBmjNsQRB2aiAEQRB1IABBEHVqQZozbGoiBSAOKALYmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2aiIANgLYmAEgFCAAQQF1QQFqQQF1NgKcBCAUIA4oAtyYAUEBdUEBakEBdTYCvAQgFCAOKALgmAFBAXVBAWpBAXU2AqwEIA4gBSAOKALYmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2aiIGNgLYmAEgDiAHIA4oAtyYASIEayIAQRB1QebMAWwgBGogAEH//wNxQebMAWxBEHZqNgLcmAEgDiADIA4oAuCYASIEayIAQRB1QebMAWwgBGogAEH//wNxQebMAWxBEHZqNgLgmAEgFCAGQQF1QQFqQQF1NgKgBCAUIA4oAtyYAUEBdUEBakEBdTYCwAQgFCAOKALgmAFBAXVBAWpBAXU2ArAEIA4gBSAOKALYmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2aiIGNgLYmAEgDiAHIA4oAtyYASIEayIAQRB1QebMAWwgBGogAEH//wNxQebMAWxBEHZqNgLcmAEgDiADIA4oAuCYASIEayIAQRB1QebMAWwgBGogAEH//wNxQebMAWxBEHZqNgLgmAEgFCAGQQF1QQFqQQF1NgKkBCAUIA4oAtyYAUEBdUEBakEBdTYCxAQgFCAOKALgmAFBAXVBAWpBAXU2ArQEIA4gBSAOKALYmAEiBGsiAEEQdUHmzAFsIARqIABB//8DcUHmzAFsQRB2aiIGNgLYmAEgDiAHIA4oAtyYASIEayIAQRB1QebMAWwgBGogAEH//wNxQebMAWxBEHZqNgLcmAEgDiADIA4oAuCYASIDayIAQRB1QebMAWwgA2ogAEH//wNxQebMAWxBEHZqNgLgmAEgFCAGQQF1QQFqQQF1NgKoBCAUIA4oAtyYAUEBdUEBakEBdTYCyAQgFCAOKALgmAFBAXVBAWpBAXU2ArgEIBFBwAlqJAAgDkHkoAFqISEgDkHkmAFqIS0gEi4BtCNBmgNsQbPmzAFqIR8gEkHsImohFyASQcwfaiEiIBJB3CBqIRkgEkHcImohNSASQYwjaiE2IBJB/CJqIRMgEkGcI2ohNyAOKAK8oQEhJiASQaAXaiEVIBIoAsgfIRsDQCAbRQRAICIgM0ECdGooAgAhJgtBgICAgAQgEyAzQQJ0IilqKAIAQRB0IhRrQRB1IgMgKSA3aigCACIAQf//A3FsQRB1IAMgAEEQdWxqIScgDigC1HYiLkEASgRAICEgDigCgHciKEECdGohDCAZIDNBBXRqIi8gKEEBdGpBAmsuAQAhKyAvLgEAISMgDi4BpHchJEEAIRAgKEEDSCENA0AgDigC5KABIQAgDiAlIBBBAXQiD2ouAQAiCEEOdDYC5KABIA4gACAOKALooAEiA0EQdSAkbGogA0H//wNxICRsQRB1aiIANgLooAEgAEEQdSAjbCAAQf//A3EgI2xBEHVqISAgAyAOKALsoAEiFiAAayIAQRB1ICRsaiAAQf//A3EgJGxBEHVqIQdBAiEGIA1FBEADQCAhIAZBAnRqIhogBzYCACAaKAIEIgkgB2siBUEQdSAkbCAWaiEEICEgBkECaiIAQQJ0aigCACEWIC8gBkEBdGoiA0ECay4BACEGIBogBCAFQf//A3EgJGxBEHVqIgQ2AgQgBiAHQRB1bCAgaiAGIAdB//8DcWxBEHVqIAMuAQAiAyAEQRB1bGogBEH//wNxIANsQRB1aiEgIAkgFiAEayIDQRB1ICRsaiADQf//A3EgJGxBEHVqIQcgACIGIChIDQALCyAMIAc2AgAgEkGAM2ogD2pB//8BQYCAfiAIIAdBEHUgK2wgIGogB0H//wNxICtsQRB1akEKdUEBakEBdWsiACAAQYCAfkwbIgAgAEH//wFOGzsBACAQQQFqIhAgLkcNAAsgDigC1HYhLiASLwGAMyEQCyApIDVqKAIAIQkgKSA2aigCACEFIBJB//8BQYCAfkEAIBcgKWooAgAiBEEQdGtBEHUiAyAnwSAUQRB1bCAfaiIAQf//A3FsQRB1IABBEHUgA2xqQQt1QQFqQQF1IgAgAEGAgH5MGyIAIABB//8BThtBEHQgBEEBdUEBakEBdSIAckEQdSIGIA4uAbShAWwgAMEiAyAQwWxqNgKAJCAuQQFrIQ8CQCAuQQJIDQBBASEHIBAhBCAuQQVPBEAgD0F8cSEIIAT9ECE8IAb9ESE6IAP9ESE5QQAhBwNAIBJBgCRqIAdBAXIiAEECdGogOiA8IBJBgDNqIABBAXRq/V0BACI8/Q0GBxAREhMUFQABAAEAAQAB/acB/bUBIDkgPP2nAf21Af2uAf0LAgAgB0EEaiIHIAhHDQALIAggD0YNASAIQQFyIQcgPP0ZAyEECwNAIBJBgCRqIAdBAnRqIAYgBMFsIAMgEkGAM2ogB0EBdGouAQAiBGxqNgIAIAdBAWoiByAuRw0ACwsgDiASQYAzaiAPQQF0ai4BADYCtKEBIA4oArChASEHIA4oAqyhASEEIA4oAqihASEGAkAgLkEATA0AIAlBEHUhGiAJwSEUIAXBIQwgJkEATARAQQAhFgNAIC0gBkEBa0H/A3EiBkEBdGpB//8BQYCAfiASQYAkaiAWQQJ0aigCACAEQRB1IgMgDGwgBEH//wNxIgAgDGxBEHVqQQJ0ayIEIAdBEHUgFGwgAyAabGogACAabEEQdWogB0H//wNxIBRsQRB1akECdGsiB0ELdUEBakEBdSIAIABBgIB+TBsiACAAQf//AU4bIgA7AQAgFSAWQQF0aiAAOwEAIBZBAWoiFiAuRw0ACwwBCyAnQQJ1IgAgJ0EPdHJBEHUhDSAAwSEPQQAhFgNAIC0gBiAmaiIAQQFrQf8DcUEBdGouAQAhCCAtIABB/wNxQQF0ai4BACEJIC0gAEH+A2pB/wNxQQF0ai4BACEFIC0gBkEBa0H/A3EiBkEBdGpB//8BQYCAfiASQYAkaiAWQQJ0aigCACAEQRB1IgMgDGwgBEH//wNxIgAgDGxBEHVqQQJ0ayIEIAdBEHUgFGwgAyAabGogACAabEEQdWogB0H//wNxIBRsQRB1akECdGsiB0ELdUEBakEBdSIAIABBgIB+TBsiACAAQf//AU4bOwEAIBUgFkEBdGpB//8BQYCAfiAHIA8gBSAJamwgCCANbGprQQt1QQFqQQF1IgAgAEGAgH5MGyIAIABB//8BThs7AQAgFkEBaiIWIC5HDQALCyAOIAc2ArChASAOIAQ2AqyhASAOIAY2AqihASAVIC5BAXQiAGohFSAAICVqISUgM0EBaiIzQQRHDQALIA4gEigC2B82AryhAUEAIRgjAEHQMWsiCyQAIAtB////DyASQeAeaiIcKAKAASIDIBwoAoQBIgAgACADShsiAyAcKAKIASIAIAAgA0obIgMgHCgCjAEiACAAIANKGyIFIAVB////D04bIgdBDEEIIAcgB0EfdSIAcyAAayIJQRBJIgYbQQRBACAJQYAgSSIEGyAJQYACSSIDG/0RIAkgCUH//wNxIgBBBHYgBhsgAEEIdiAJwUEMdSAEGyADGyIAQQhxRf0R/QwCAAAAAgAAAAIAAAACAAAA/QwDAAAAAwAAAAMAAAADAAAAIABBAnEbIABBDHEb/VD9DBAAAAAQAAAAEAAAABAAAAD9UP0MIAAAACAAAAAgAAAAIAAAACAFG0EMQQggCUGAgMAASSIGG0EEQQAgCUGAgICAAUkiBBsgCUGAgIAISSIDG/0RIAlBEHYiACAJQRR2IAYbIABBCEEMIAQbdiADGyIAQQhxRf0R/QwCAAAAAgAAAAIAAAACAAAA/QwDAAAAAwAAAAMAAAADAAAAIABBAnEbIABBDHEb/VAgCUGAgARJ/RFBH/2rAUEf/awB/VIiPf0M//////////////////////2uASI5/RsAdP0RIAcgOf0bAXT9HAEgByA5/RsCdP0cAiAHIDn9GwN0/RwDIkRB/////wEgHP0AAoABIkf9GwD9DAwAAAAMAAAADAAAAAwAAAD9DAgAAAAIAAAACAAAAAgAAAAgR/2gASJF/QwAABAAAAAQAAAAEAAAABAA/ToiOf1S/QwEAAAABAAAAAQAAAAEAAAA/QwAAAAAAAAAAAAAAAAAAAAAIEX9DAAAAAEAAAABAAAAAQAAAAH9QCBF/QwAAAAQAAAAEAAAABAAAAAQ/Tr9TiI7QR/9qwFBH/2sAf1SIEX9DAAAAQAAAAEAAAABAAAAAQD9QCBF/QwAAAABAAAAAQAAAAEAAAAB/Tr9TiI/QR/9qwFBH/2sAf1SIjogRUEQ/a0BIjwgRf0NAAEEBQgJDA0AAQABAAEAASBFQRT9rQEgRf0NAAEEBQgJDA0AAQABAAEAASA5IEX9DQABBAUICQwNAAEAAQABAAH9Uv0MAAAAAAAAAAAAAAAAAAAAACA8/RsA/QwIAAgACAAIAAgACAAIAAgA/QwMAAwADAAMAAwADAAMAAwAIDsgRf0NAAEEBQgJDA0AAQABAAEAAUEP/YsBQQ/9jAH9UiI5/RkAdv0aACA8/RsBIDn9GQF2/RoBIDz9GwIgOf0ZAnb9GgIgPP0bAyA5/RkDdv0aAyA/IEX9DQABBAUICQwNAAEAAQABAAFBD/2LAUEP/YwB/VIiQ/0MCAAIAAgACAAIAAgACAAIAP1O/QwAAAAAAAAAAAAAAAAAAAAA/S0gRf0NAAEAAQIDAAEEBQABBgcAAf0MAQAAAAEAAAABAAAAAQAAAP1O/VAgOv0MAwAAAAMAAAADAAAAAwAAAP1QIDr9DAIAAAACAAAAAgAAAAIAAAD9UP0MDAAAAAwAAAAMAAAADAAAAP0MCAAAAAgAAAAIAAAACAAAACBF/QwQAAAAEAAAABAAAAAQAAAA/ToiQP1S/QwEAAAABAAAAAQAAAAEAAAA/QwAAAAAAAAAAAAAAAAAAAAAIEf9DAAAAAAAAAAAAAAAAAAAAAD9OCI+IEX9DAAAAQAAAAEAAAABAAAAAQD9OiJC/U4iQSBF/QwAAQAAAAEAAAABAAAAAQAA/UD9TiBF/QwAEAAAABAAAAAQAAAAEAAA/Tr9TiI8QR/9qwFBH/2sAf1SIEEgRf0MAAEAAAABAAAAAQAAAAEAAP06/U4iOkEf/asBQR/9rAH9UiI5IEUgRf0NAAEEBQgJDA0AAQABAAEAASJGIEZBBP2NASBAIEX9DQABBAUICQwNAAEAAQABAAH9UiBGQQj9jQEgRkEM/YwBIDwgRf0NAAEEBQgJDA0AAQABAAEAAUEP/YsBQQ/9jAH9UiA6IEX9DQABBAUICQwNAAEAAQABAAFBD/2LAUEP/YwB/VIiOv0MCAAIAAgACAAIAAgACAAIAP1O/QwAAAAAAAAAAAAAAAAAAAAA/S0gRf0NAAEAAQIDAAEEBQABBgcAAf0MAQAAAAEAAAABAAAAAQAAAP1O/VAgOf0MAwAAAAMAAAADAAAAAwAAAP0MAgAAAAIAAAACAAAAAgAAACBBIDr9DA4ADgAOAA4ADgAOAA4ADgD9Tv0MAAAAAAAAAAAAAAAAAAAAAP0tIEX9DQABAAECAwABBAUAAQYHAAH9TkEf/asBQR/9rAH9Uv1Q/QwQAAAAEAAAABAAAAAQAAAAID79UiBBIDr9DAwADAAMAAwADAAMAAwADAD9Tv0MAAAAAAAAAAAAAAAAAAAAAP0u/acB/U79Uv0MEAAAABAAAAAQAAAAEAAAAP2uASA7IEX9DAAAABAAAAAQAAAAEAAAABD9QP1QID/9UCI/IEP9DAwADAAMAAwADAAMAAwADAD9Tv0MAAAAAAAAAAAAAAAAAAAAAP0t/acBIjz9TiI6IEP9DAIAAgACAAIAAgACAAIAAgD9Tv0MAAAAAAAAAAAAAAAAAAAAAP0t/acBIjn9TyJAQR/9qwFBH/2sAf1SIDogOf1OIj5BH/2rAUEf/awB/VIgPyA8/U8iPEEf/asBQR/9rAH9UiI6/Qz//////////////////////a4BIjn9GwB0/REgR/0bASA5/RsBdP0cASBH/RsCIDn9GwJ0/RwCIEf9GwMgOf0bA3T9HAMiOUEQ/awBIj/9GwBt/RFB/////wEgP/0bAW39HAFB/////wEgP/0bAm39HAJB/////wEgP/0bA239HANBEP2rAUEQ/awBIkMgRP0M//8AAP//AAD//wAA//8AAP1O/bUBQRD9rAEgQyBEQRD9rAH9tQH9rgEiPyA5/dwBQR39zQEgPyA5/d0BQR39zQH9DQABAgMICQoLEBESExgZGhv9DPj////4////+P////j////9Tv2xASI5QRD9rAEgQ/21ASA//a4BIDn9DP//AAD//wAA//8AAP//AAD9TiBD/bUBQRD9rAH9rgEiP/0bACA9IDr9sQEiOv0MDwAAAA8AAAAPAAAADwAAAP2uASI5/RsAdf0RID/9GwEgOf0bAXX9HAEgP/0bAiA5/RsCdf0cAiA//RsDIDn9GwN1/RwD/QwAAAAAAAAAAAAAAAAAAAAAIDr9DB0AAAAdAAAAHQAAAB0AAAD9rgH9DC4AAAAuAAAALgAAAC4AAAD9Ov1SQf////8H/Qzx////8f////H////x////IDr9sQEiOf0bACIGdv0RQf////8HIDn9GwEiBHb9HAFB/////wcgOf0bAiIDdv0cAkH/////ByA5/RsDIgB2/RwDIjkgP0GAgICAeCAGdf0RQYCAgIB4IAR1/RwBQYCAgIB4IAN1/RwCQYCAgIB4IAB1/RwD/bgBID8gOf07/VIiOf0bACAGdP0RIDn9GwEgBHT9HAEgOf0bAiADdP0cAiA5/RsDIAB0/RwDIEIgPv1QIED9UCA8/VAgOv0M8f////H////x////8f////07/U5BH/2rAUEf/awB/VIiRf0MawEAAGsBAABrAQAAawEAAP24ASJIQRD9qwFBEP2sASI5IEj9DP//AAD//wAA//8AAP//AAD9Tv21AUEQ/awBIDkgSEEQ/a0B/bUB/a4BQQH9rAH9CwSQCSAOIgwoAtB2IQACQCAcKAJoRQRAIBIgAEEBdGoiBiAAQX5xaiErIAwoAtR2Ih1B//8DcUGPBWxBEHYgHUEQdUGPBWxqISMgHEHsAGohGiAdQfz///8HcSEFIB1BA2ohMiAdQQFrITMgC0GgCWohESAdQQRJISogHEHQAWoiMCExA0BBfiAaIBhBAnQiNGooAgBrQQF0QQAhAEEAIQMgKyAGIBhBAkYbIixBAnEEQCAsLgEAIgAgAGwhA0EBIQALAn8DQEEAIAAgM04NARogAEEBdCEEIABBAmohACADIAQgLGooAgAiBkEQdSIEIARsaiAGwSIDIANsaiIDQQBODQALIANBAnYhA0ECCyEGIAAgM0gEQANAIAMgLCAAQQF0aigCACIHwSIEIARsIAdBEHUiBCAEbGogBnZqIgNBAnYgAyADQQBIIgQbIQMgBkECaiAGIAQbIQYgAEECaiIAIDNIDQALCyAsaiETIAAgM0YEQCAsIDNBAXRqLgEAIgAgAGwgBnYgA2ohAwsgC0GwKGogNGoiGyADIANBAnYgA0GAgICABEkiABsiBDYCACAGIAZBAmogABshDwJAIARBgIAESQ0AIARBEHYhAAJ/IARBgICACE8EQCAEQYCAgIABTwRAIADBQQx1IQBBAAwCCyAAQQh2IQBBBAwBCyAAIABBBHYgBEGAgMAASSIDGyEAQQxBCCADGwshAyAAQQxxRQ0AIAMNACAbIAMgAEEIcUVyIgBBAUYEfyAEQQFxIARBAXVqBSAEQQEgAGt1QQFqQQF1CyIENgIAIA8gAGtBAmohDwsgCyA0aiIUIA82AgBBACEAQQAhAyATQQJxBEAgEy4BACIAIABsIQNBASEACwJ/A0BBACAAIDJODQEaIABBAXQhBiAAQQJqIQAgAyAGIBNqKAIAIgdBEHUiBiAGbGogB8EiAyADbGoiA0EATg0ACyADQQJ2IQNBAgshBiAAIDJIBEADQCADIBMgAEEBdGooAgAiCcEiByAHbCAJQRB1IgcgB2xqIAZ2aiIDQQJ2IAMgA0EASCIHGyEDIAZBAmogBiAHGyEGIABBAmoiACAySA0ACwsgACAyRgRAIBMgMkEBdGouAQAiACAAbCAGdiADaiEDCyAGIAZBAmogA0GAgICABEkiABshB0EAIQYCQCADIANBAnYgABsiCUGAgARJDQAgCUEQdiEIAn8gCUGAgIAISSIDRQRAIAlBgICAgAFPBEAgCMFBDHUhEEEADAILIAhBCHYhEEEEDAELIAggCEEEdiAJQYCAwABJIgAbIRBBDEEIIAAbCyEAIBBBDHEEfyAQQQhxRQVBAkEDIBBBAnEbCyAAckEBSw0AAn8gA0UEQCAJQYCAgIABTwRAIAjBQQx1IQNBAAwCCyAIQQh2IQNBfAwBCyAIIAhBBHYgCUGAgMAASSIAGyEDQXRBeCAAGwshACADQQxxBH8gA0EDdkEBcUEBawVBfkF9IANBAnEbCyAAakECaiEGCyAR/QwAAAAAAAAAAAAAAAAAAAAAIAkgBnX9HAAgE/0DAQAiOSA5/bUBIAYgB2oiB/2tAf2xASI5IDn9DP//AAD//wAA//8AAP//AAD9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5/Qz//wAA//8AAP//AAD//wAA/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIA8gB2tBACAHIA9IG3UiAzYCAEEBIQkgESATQQZqIgYuAQAiACAAbCAHIA8gByAPSiIOGyIediADIBNBCGoiACAdQQF0IghqIg1BAmsuAQAiAyADbCAedmtqIgM2AhhBBCEHIBEgAyANQQRrLgEAIgMgA2wgHnZrIBMuAQQiAyADbCAedmoiAzYCMCARIAMgDUEGay4BACIDIANsIB52ayATLgECIgMgA2wgHnZqIgM2AkggESADIAggE2ouAQAiAyADbCAedmsgEy4BACIDIANsIB52ajYCYAJAIB5BAEoEQANAAkAgHUEATARAQQAhCAwBC0EAIQMCQCAqBEBBACEIDAEL/QwAAAAAAAAAAAAAAAAAAAAAIT0DQCAGIANBAXQiCGr9AwEAIAAgCGr9AwEA/bUBIB79rAEgPf2uASE9IANBBGoiAyAFRw0ACyA9ID39DP//AAD//wAA//8AAP//AAD9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5/Qz//wAA//8AAP//AAD//wAA/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQggBSIDIB1GDQELA0AgCCAGIANBAXQiDWouAQAgACANai4BAGwgHnVqIQggA0EBaiIDIB1HDQALCyARIAlBFGxqIAg2AgAgESAJQQJ0aiAINgIAQQEhAyAJQQNNBEADQCARIAMgCWoiDUEUbGogA0ECdGogCCAGIB0gA2tBAXQiCGouAQAgACAIai4BAGwgHnVrIAYgA0EBdCIIay4BACAAIAhrLgEAbCAedWoiCDYCACARIANBFGxqIA1BAnRqIAg2AgAgA0EBaiIDIAdHDQALCyAHQQFrIQcgBkECayEGIAlBAWoiCUEFRw0ACwwBCwNAQQAhCAJAIB1BAEwNAP0MAAAAAAAAAAAAAAAAAAAAACE9QQAhAyAqRQRAA0AgBiAIQQF0IgNq/QMBACAAIANq/QMBAP21ASA9/a4BIT0gCEEEaiIIIAVHDQALID0gPf0M//8AAP//AAD//wAA//8AAP0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDn9DP//AAD//wAA//8AAP//AAD9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhCCAFIgMgHUYNAQsDQCAIIAYgA0EBdCINai4BACAAIA1qLgEAbGohCCADQQFqIgMgHUcNAAsLIBEgCUEUbGogCDYCACARIAlBAnRqIAg2AgBBASEDIAlBA00EQANAIBEgAyAJaiINQRRsaiADQQJ0aiAIIAYgHSADa0EBdCIIai4BACAAIAhqLgEAbGsgBiADQQF0IghrLgEAIAAgCGsuAQBsaiIINgIAIBEgA0EUbGogDUECdGogCDYCACADQQFqIgMgB0cNAAsLIAdBAWshByAGQQJrIQYgCUEBaiIJQQVHDQALCyAUIB42AgBBACEKAkACQCAeQQBKBEAgHUEATA0BA0BBACEGQQAhAwJAICpFBED9DAAAAAAAAAAAAAAAAAAAAAAhPQNAICwgA0EBdCIGav0DAQAgACAGav0DAQD9tQEgHv2sASA9/a4BIT0gA0EEaiIDIAVHDQALID0gPf0M//8AAP//AAD//wAA//8AAP0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDn9DP//AAD//wAA//8AAP//AAD9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhBiAFIgMgHUYNAQsDQCAGICwgA0EBdCIGai4BACAAIAZqLgEAbCAedWohBiADQQFqIgMgHUcNAAsLIAtB8CJqIApBAnRqIAY2AgAgAEECayEAIApBAWoiCkEFRw0ACwwCCwNAQQAhAwJAIB1BAEwNAAJAICoEQEEAIQYMAQv9DAAAAAAAAAAAAAAAAAAAAAAhPQNAICwgA0EBdCIGav0DAQAgACAGav0DAQD9tQEgPf2uASE9IANBBGoiAyAFRw0ACyA9ID39DP//AAD//wAA//8AAP//AAD9DQgJCgsMDQ4PAAECAwABAgP9rgEiOSA5/Qz//wAA//8AAP//AAD//wAA/Q0EBQYHAAECAwABAgMAAQID/a4B/RsAIQMgBSIGIB1GDQELA0AgAyAsIAZBAXQiA2ouAQAgACADai4BAGxqIQMgBkEBaiIGIB1HDQALCyALQfAiaiAKQQJ0aiADNgIAIABBAmshACAKQQFqIgpBBUcNAAsMAQsgC0GAI2pBADYCACAL/QwAAAAAAAAAAAAAAAAAAAAA/QsE8CILIBEgESgCACIGIAQgHiAPa0EAIA4bdSIDQf//A3FB2gFsQRB2IAZB//8DcUHaAWxBEHZqIBEoAmAiAEH//wNxQdoBbEEQdmogBkEQdSADQRB1aiAAQRB1akHaAWxqQQFqIgZqIgQ2AgAgESARKAIYIAZqIhY2AhggESARKAIwIAZqIiA2AjAgESARKAJIIAZqIi42AkggESAAIAZqIg82AmAgGyADIAZqIh82AgBBgAQCfyAEIA9qIgBBAE4EQEGAgICAeCAAIAQgD3FBAEgbDAELQf////8HIAAgBCAPckEAThsLrELjpwF+QiCIpyIAIABBgARMGyEVQQAhJANAQQAhBwNAIAciCUEUbCENAkAgB0UEQEEAIQoMAQsgC0EQaiANaiEHQQAhBkEAIQogCUEDSwRAIAlB/P///wdxIQb9DAAAAAAAAAAAAAAAAAAAAAAhPUEAIQADQCAAQQJ0IgMgC0HwFWpqIAMgB2r9AAIAIjlBEP2rAUEQ/awBIjwgC0HwDWogA2r9AAQAIjr9DP//AAD//wAA//8AAP//AAD9Tv21AUEQ/awBIDwgOkEQ/awB/bUB/a4BIDlBD/2sASI5/QwBAAAAAQAAAAEAAAABAAAA/U4gOf0MAQAAAAEAAAABAAAAAQAAAP1RQQH9rAH9rgEiOSA6/bUB/a4BIjr9CwQAIDogOf21ASA9/a4BIDpBEP2sASA8/bUB/a4BIDr9DP//AAD//wAA//8AAP//AAD9TiA8/bUBQRD9rAH9rgEhPSAAQQRqIgAgBkcNAAsgPSA9/Qz//wAA//8AAP//AAD//wAA/Q0ICQoLDA0ODwABAgMAAQID/a4BIjkgOf0M//8AAP//AAD//wAA//8AAP0NBAUGBwABAgMAAQIDAAECA/2uAf0bACEKIAYgCUYNAQsDQCAGQQJ0IgMgC0HwFWpqIAMgB2ooAgAiAMEiCCALQfANaiADaigCACIDQf//A3FsQRB1IAggA0EQdWxqIABBD3VBAWpBAXUiACADbGoiAzYCACAAIANsIApqIANBEHUgCGxqIANB//8DcSAIbEEQdWohCiAGQQFqIgYgCUcNAAsLAkACQAJAIBEgCUEYbCIAaigCACAKayIQIBVIIhdFBEAgCUECdCIIIAtB8A1qaiAQNgIAIAtBEGogAGpBgIAENgIAIAtBsClqIAlBA3RqIgZBACAQAn8gECAQQR91IgBzIABrIgdBgIAETwRAIAdBEHYhAAJ/IAdBgICACE8EQCAHQYCAgIABTwRAIABBDHYhA0EADAILIABBCHYhA0EEDAELIAAgAEEEdiAHQYCAwABJIgAbIQNBDEEIIAAbCyEAIAAgA0EIcUVyIANBDHENARogAEECciADQQJxDQEaIABBA3IMAQtBFEEQIAdBgCBJIgMbIQACfyAHQYD+A3FBCHYgB8FBDHUgAxsiA0EMcQRAIANBCHFFDAELQQJBAyADQQJxGwsgAHILIgNBAWt0IgBB//8DcUH/////ASAAQRB1IgBtIgfBIg5sQRB1IAAgDmxqQQN0ayIAIAdBD3VBAWpBAXVsIAdBEHRqIABBEHUgDmxqIABB+P8DcSAObEEQdWpBGiADa3UiDjYCACAGQYCAgAggDkEUdEEQdSIGIBBB//8DcWxBEHUgDkEEdEEPdUEBakEBdSIAIBBsIAYgEEEQdmxqamsiA0EQdSAGbCAAIANsaiADQf//A3EgBmxBEHVqIgA2AgQgCUEBaiEHIAlBBEkNAQwCCyARICRBEHRBgIAEakEQdSAVbCAQayIAIA9qIg82AmAgESAAIC5qIi42AkggESAAICBqIiA2AjAgESAAIBZqIhY2AhggESAAIARqIgQ2AgAMAgsgDSARaiEpIAtBEGogCGohCiAOQQ91QQFqQQF1ISEgDsEhLSAArCFOIAlFBEAgCkHQAGogKf0AAgQiOkEQ/awBIC39ESI5/bUBIDogIf0R/bUB/a4BIDr9DP//AAD//wAA//8AAP//AAD9TiA5/bUBQRD9rAH9rgFBBP2sASBO/RIiOSA6/ccB/dUBQSD9zQEgOSA6/cgB/dUBQSD9zQH9DQABAgMICQoLEBESExgZGhv9rgEiOf1aAgADIApBPGogOf1aAgACIApBKGogOf1aAgABIApBFGogOf1aAgAADAELIAsoAvwVIiZB//8DcSEiICZBEHUhGSALKAL4FSInQf//A3EhJSAnQRB1IRMgCygC9BUiKEH//wNxIRsgKEEQdSEUIAsoAvAVIi9B//8DcSEQIC9BEHUhDiALQRBqIAdBFGxqIQYgByEAA0AgCiAAQRRsaiApIABBAnRqKAIAAn8gBigCACIIwSIDIA5sIAMgEGxBEHVqIAhBD3VBAWpBAXUgL2xqIg0gCUEBRg0AGiANIAYoAgQiCMEiAyAUbGogAyAbbEEQdWogCEEPdUEBakEBdSAobGoiDSAJQQJGDQAaIA0gBigCCCIIwSIDIBNsaiADICVsQRB1aiAIQQ91QQFqQQF1ICdsaiINIAlBA0YNABogDSAGKAIMIgjBIgMgGWxqIAMgImxBEHVqIAhBD3VBAWpBAXUgJmxqC2siA0EQdSAtbCADICFsaiADQf//A3EgLWxBEHVqQQR1IAOsIE5+QiCIp2o2AgAgBkEUaiEGIABBAWoiAEEFRw0ACwsgB0EFRw0BCwsgJEEDTQRAICRBAWohJCAXDQELC0EAIQkDQEEAIQYCQCAJRQ0AIAtBEGogCUEUbGohDUEAIQAgCUEETwRAIAlB/P///wdxIQD9DAAAAAAAAAAAAAAAAAAAAAAhPUEAIQMDQCADQQJ0IgYgC0HwFWpq/QAEACI6QRD9qwFBEP2sASI5IAYgDWr9AAIAIjxBEP2sAf21ASA9/a4BIDkgPP0M//8AAP//AAD//wAA//8AAP1O/bUBQRD9rAH9rgEgOkEP/awBIjn9DAEAAAABAAAAAQAAAAEAAAD9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uASA8/bUB/a4BIT0gA0EEaiIDIABHDQALID0gPf0M//8AAP//AAD//wAA//8AAP0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDn9DP//AAD//wAA//8AAP//AAD9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhBiAAIAlGDQELA0AgBiAAQQJ0IgggC0HwFWpqKAIAIgfBIgMgCCANaigCACIIQRB1bGogAyAIQf//A3FsQRB1aiAHQQ91QQFqQQF1IAhsaiEGIABBAWoiACAJRw0ACwsgCUECdCIAIAtB8BVqaiALQfAiaiAAaigCACAGazYCACAJQQFqIglBBUcNAAtBECEJIAsgC/0ABLApIj4gC/0ABMApIjz9DQABAgMICQoLEBESExgZGhsiOkEP/awBIjn9DAEAAAABAAAAAQAAAAEAAAD9TiA5/QwBAAAAAQAAAAEAAAABAAAA/VFBAf2sAf2uASAL/QAE8BUiQP21ASBAQRD9rAEgOkEQ/asBQRD9rAEiOf21Af2uASBA/Qz//wAA//8AAP//AAD//wAA/U4gOf21AUEQ/awB/a4BQQT9rAEgQCA+/Qz//wAA//8AAP//AAD//wAA/Q0EBQYHDA0ODwABAgMAAQID/dwBQSD9zQEgQP3IASA8/Qz//wAA//8AAP//AAD//wAA/Q0EBQYHDA0ODwABAgMAAQID/ccB/dUBQSD9zQH9DQABAgMICQoLEBESExgZGhv9rgH9CwTwFSALKALwFSEIIAsoAiQhJyALKAI4ISggCygCTCEvIAsoAmAhFyALKAL0FSEHIAsoAjwhIiALKAJQIRkgCygCZCElIAsoAvgVIQYgCygCVCETIAsoAmghGyALKAL8FSEDIAsoAmwhFCAxQf//AUGAgH4gCygCgBYiDSALKALQKSIAQQ91QQFqQQF1bCAAwSIAIA1BEHVsaiANQf//A3EgAGxBEHVqQQR1IAs0AtQpIA2sfkIgiKdqIg1BAXVBAWpBAXUiACAAQYCAfkwbIgAgAEH//wFOGyIQOwEIIDFB//8BQYCAfiADIA3BIiYgFEEQdWwgJiAUQf//A3FsQRB1aiAUIA1BD3VBAWpBAXUiDmxqayIDQQF1QQFqQQF1IgAgAEGAgH5MGyIAIABB//8BThs7AQYgMUH//wFBgIB+IAYgJiAbQRB1bCAmIBtB//8DcWxBEHVqIA4gG2xqIAPBIhQgE0EQdWxqIBQgE0H//wNxbEEQdWogEyADQQ91QQFqQQF1Ig1samsiA0EBdUEBakEBdSIAIABBgIB+TBsiACAAQf//AU4bOwEEIDFB//8BQYCAfiAHICYgJUEQdWwgJiAlQf//A3FsQRB1aiAOICVsaiAUIBlBEHVsaiAUIBlB//8DcWxBEHVqIA0gGWxqIAPBIgcgIkEQdWxqIAcgIkH//wNxbEEQdWogIiADQQ91QQFqQQF1IgNsamsiBkEBdUEBakEBdSIAIABBgIB+TBsiACAAQf//AU4bOwECIDFB//8BQYCAfiAIICYgF0EQdWwgJiAXQf//A3FsQRB1aiAOIBdsaiAUIC9BEHVsaiAUIC9B//8DcWxBEHVqIA0gL2xqIAcgKEEQdWxqIAcgKEH//wNxbEEQdWogAyAobGogBsEiACAnQRB1bGogACAnQf//A3FsQRB1aiAnIAZBD3VBAWpBAXVsamtBAXVBAWpBAXUiACAAQYCAfkwbIgAgAEH//wFOGzsBAAJAIDH9XQEAIjr9gAH9qQEiOSA5/Qz//wAA//8AAP//AAD//wAA/Q0ICQoLDA0ODwABAgMAAQID/bgBIjkgOf0M//8AAP//AAD//wAA//8AAP0NBAUGBwABAgMAAQIDAAECA/24Af0bACIDIBAgEEEfdSIAcyAAayIAIAAgA0gbIgBFBEBBACEADAELAn8gAEGAAk8EQCAAQYAgTwRAIADBQQx1IQNBAAwCCyAAQYD+A3FBCHYhA0EEDAELIAAgAEHw/wNxQQR2IABBEEkiBhshA0EMQQggBhsLIQYgA0EMcQRAIAYgA0EIcUVyIQkMAQsgA0ECcQRAIAZBAnIhCQwBCyAGQQNyIQkLQQMgCSAJQQNOG0EBayEGQQAhCSALIDr9pwEgBgJ/IADBIgMgBCAPIAQgD0obIgBB//8DcWxBEHUgAEEQdSADbGoiAEEEdUEFbCIDQYCABE8EQCADQRB2IQACfyADQYCAgAhPBEAgA0GAgICAAU8EQCAAwUEMdSEAQQAMAgsgAEEIdiEAQQQMAQsgACAAQQR2IANBgIDAAEkiAxshAEEMQQggAxsLIQMgAyAAQQhxRXIgAEEMcQ0BGiADQQJyIABBAnENARogA0EDcgwBCwJ/QRAgAEEQSQ0AGgJ/IANBgAJPBEAgA0GAIE8EQCADwUEMdSEAQQAMAgsgA0GA/gNxQQh2IQBBBAwBCyADIANB8P8DcUEEdiADQRBJIgMbIQBBDEEIIAMbCyEDIAMgAEEIcUVyIABBDHENABogA0ECciAAQQJxDQAaIANBA3ILQRBqC0EFayIAIAAgBkobIgBBACAAQQBKGyIl/asBIjn9CwQQIDlBEP2rAUEQ/awBIjogC/0ABPAiIjlBEP2sAf21ASA6IDn9DP//AAD//wAA//8AAP//AAD9Tv21AUEQ/awB/a4BITwgH0EDICVrIht1IAsgECAldCIANgIgIADBIgMgCygCgCMiAEEQdWwgAyAAQf//A3FsQRB1IQ4gC/0AAhRBEP2rAUEQ/awBITpBACEHA0AgCSIGQQFqIQkgESAGQRRsaiETQQAhAwJAIAZBA0sNACAJIQAgBkUEQCA6IBP9AAIEIjlBEP2sAf21ASA6IDn9DP//AAD//wAA//8AAP//AAD9Tv21AUEQ/awB/a4BIjkgOf0M//8AAP//AAD//wAA//8AAP0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDn9DP//AAD//wAA//8AAP//AAD9DQQFBgcAAQIDAAECAwABAgP9rgH9GwAhAwwBCwNAIAMgAEECdCIIIAtBEGpqLgEAIg0gCCATaigCACIIQRB1bGogDSAIQf//A3FsQRB1aiEDIABBAWoiAEEFRw0ACwsgByADIAZBAnQiACALQRBqai4BACIDIAAgE2ooAgAiAEERdWxqIAMgAEEBdkH//wNxbEEQdWoiAEEQdSADbGogAEH//wNxIANsQRB1aiEHIAlBBUcNAAtBASEDIDwgPP0M//8AAP//AAD//wAA//8AAP0NCAkKCwwNDg8AAQIDAAECA/2uASI5IDn9DP//AAD//wAA//8AAP//AAD9DQQFBgcAAQIDAAECAwABAgP9rgH9GwBqIA5qayAHQQIgJWt0aiIAQQBKBEBB/////wMgACAbdCAAQf////8HQQQgJWt2SxshAwsgC0HwHWogNGogAzYCACAEIBEoAgQiACAAIARIGyIEIBEoAggiACAAIARIGyIEIBEoAgwiACAAIARIGyIEIBEoAhAiACAAIARIGyIEIBEoAhQiACAAIARIGyIAIBYgACAWShsiBCARKAIcIgAgACAESBsiBCARKAIgIgAgACAESBsiBCARKAIkIgAgACAESBsiBCARKAIoIgAgACAESBsiBCARKAIsIgAgACAESBsiACAgIAAgIEobIgQgESgCNCIAIAAgBEgbIgQgESgCOCIAIAAgBEgbIgQgESgCPCIAIAAgBEgbIgQgESgCQCIAIAAgBEgbIgQgESgCRCIAIAAgBEgbIgAgLiAAIC5KGyIEIBEoAkwiACAAIARIGyIEIBEoAlAiACAAIARIGyIEIBEoAlQiACAAIARIGyIEIBEoAlgiACAAIARIGyIEIBEoAlwiACAAIARIGyIAIA8gACAPShsiCEEAIAhBAEobIQkCQCALQZAJaiA0aigCACIAQRB0QQFB/////wdBAiAeIB5BAk4bIgZBAWoiB3YiBCAAwSIAIANB//8DcWxBEHUgACADQRB1bGoiA0GAgICAeCAHdSIAIAAgA0gbIAMgBEobIAd0ICMgHiAGayIDdWoiACAAQQFMG20gA0EFanUiA0EQAn8gCEGAgAROBEAgCUEQdiEAAn8gCEGAgIAITwRAIAhBgICAgAFPBEAgAEEMdiEAQQAMAgsgAEEIdiEAQQQMAQsgACAAQQR2IAhBgIDAAEkiBBshAEEMQQggBBsLIQQgBCAAQQhxRXIgAEEMcQ0BGiAEQQJyIABBAnENARogBEEDcgwBCyAIQQBMDQECfyAIQYACTwRA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GwL9GgMgPv0bAv0aBCA6/Q0AARITBAUGBwgJCgsUFQ4P/QsB4AEgHCA5IED9DQABEBEAAQABAAEEBRQVAAEgPv0bAP0aAiA8/RsA/RoDID79GwH9GgcgOv0NAAECAwQFBgcQEQoLDA0OD/0LAdABIAwoAoCzASEXAkAgDCgClHcEQCAcQe4BaiEUIBxB5AFqIRAgHEHaAWohDiALQRBqIgNBDHIhDSALQcwLaiEIIANBCHIhCSALQegKaiEHIANBBHIhBSALQYQKaiEGQf////8HIQ8DQCALQRBqIAtBsClqIiIgMCALQaAJaiAAQQJ0IgNBsNYBaigCACIZIANBgKwBaigCACIlIBcgA0HgsQFqKAIAIhMQGiALKAKwKSEbIAUgIiAOIAYgGSAlIBcgExAaIAsoArApIQMgCSAiIBAgByAZICUgFyATEBogCygCsCkhBCANICIgFCAIIBkgJSAXIBMQGiAPQf7///8HQf7///8HIAsoArApQf////8HIARB/////wcgA0H/////ByAbIBtBAEgbaiIDIANBAEgbaiIDIANBAEgbaiIDIANB/v///wdOGyADQQBIGyIDSgRAIBwgC/0ABBD9CwIMIBwgADYCCCADIQ8LIANBgtYATgRAIABBAkkgAEEBaiEADQELCyAcKAIIIQAMAQsgC0EQaiIEIAtBsClqIhkgMCALQaAJaiIDQZCsAUHgqgEgF0EKEBogCygCsCkhByAEQQRyIiUgGSAcQdoBaiITIAtBhApqIhtBkKwBQeCqASAXQQoQGiALKAKwKSEAIARBCHIiFCAZIBxB5AFqIhAgC0HoCmoiDkGQrAFB4KoBIBdBChAaIAsoArApIQUgBEEMciINIBkgHEHuAWoiDyALQcwLaiIIQZCsAUHgqgEgF0EKEBogCygCsCkhBiAcIAv9AAQQ/QsCDCAcQQA2AgggBCAZIDAgA0GArQFBgKsBIBdBFBAaIAsoArApIQkgJSAZIBMgG0GArQFBgKsBIBdBFBAaIAsoArApIQQgFCAZIBAgDkGArQFBgKsBIBdBFBAaIAsoArApIQMgDSAZIA8gCEGArQFBgKsBIBdBFBAaQf7///8HQf7///8HIAZB/////wcgBUH/////ByAAQf////8HIAcgB0EASBtqIgAgAEEASBtqIgAgAEEASBtqIgAgAEH+////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bXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50NjRfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50NjRfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AAIjIVNJTEtfVjMAANhvAACsBwAA2G8AAIAHAAAkcQAAjAcAANQIAAAxM2NhbGxiYWNrX3R5cGUAaXBwaXAAAADUCAAA1AgAAOxwAAC0BwAATlN0M19fMjEyYmFzaWNfc3RyaW5nSWNOU18xMWNoYXJfdHJhaXRzSWNFRU5TXzlhbGxvY2F0b3JJY0VFRUUAAOxwAAD8BwAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAAOxwAABECAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURzTlNfMTFjaGFyX3RyYWl0c0lEc0VFTlNfOWFsbG9jYXRvcklEc0VFRUUAAADscAAAkAgAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAA7HAAANwIAABOMTBlbXNjcmlwdGVuM3ZhbEUAAOxwAAD4CAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAADscAAAIAkAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAA7HAAAEgJAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAOxwAABwCQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAADscAAAmAkAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAA7HAAAMAJAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAAOxwAADoCQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAADscAAAEAoAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAA7HAAADgKAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAAOxwAABgCgAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJeEVFAADscAAAiAoAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXlFRQAA7HAAALAKAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lmRUUAAOxwAADYCgAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZEVFAEGAFgslMHUAAHAXAAAg0f//INH//wBAAABsIgAAQg8AABIGAABNAgAA2wBBsBYLFe0AAACZAAAASQAAAB4AAAAMAAAABwBB0RYLFUAAAJNdAAC9cAAA7XkAALJ9AAAkfwBB8BYL5gG3uAzPn/8cARH+NQEcKF1Pov+cAND/MP1gF2ZH0//8/+0AsfzsCUY5AAAAAAAAAACN0TrPFADTAG/9sALnICc+1P/FAGj/c/0PD9cyAAAAAG8J08yeANn+cP7xBOASIB/WM1bK2v6F/+sC+wcLDZsPaf/J/p4BLwaDCyUP3/97/o8AdQTHCUUOAAAAAAAAAAADQVDJtf4TAEUCjQXyCB0L3nqqYBbaxvIJukXM3WAxcPYrdQwO9in6ts4qLcRbx+YWOAjtPjkwzWgRb0svwyFM2uTBUwnLQgnAM9eiPl7y2rZoMsgpBABB4BgL9gh5/VwHfnWP/cgGXHWl/TcGNXW7/agFC3XR/RwF3XTn/ZEEq3T9/QgEdXQS/oIDO3Qn/v4C/XM8/nwCu3NR/vwBdnNm/n8BLHN6/gQB33KP/osAj3Kj/hQAOnK2/p//4nHK/i3/hnHd/rz+J3Hx/k7+xHAD/+L9XXAW/3n9828p/xH9hm87/6z8FG9N/0n8oG5e/+j7KG5w/4n7rW2B/y37Lm2S/9L6rGyi/3r6J2yz/yT6nmvD/9D5EmvT/3/5hGri/y/58mnx/+L4XGkAAJf4xGgPAE74KWgdAAf4i2csAML36mY5AH/3RmZHAD73n2VUAP/29WRhAMP2SWRuAIj2mmN6AFD26GKGABr2NGKSAOX1fGGdALP1w2CoAIP1B2CzAFT1SF++ACj1h17IAP30w13SANX0/VzcAK70NVzlAIr0a1vuAGf0nlr3AEb00Fn/ACf0/1gHAQr0LFgPAe/zV1cXAdbzgFYeAb7zp1UlAajzzVQsAZTz8FMyAYLzElM4AXHzMlI+AWPzUFFDAVbzbVBIAUrziE9NAUHzok5SATjzuk1WATLz0UxaAS3z5kteASrz+kphASjzDUpkASjzHklnASrzLkhqAS3zPkdsATHzTEZuATfzWUVwAT7zZURxAUfzcENzAVHzekJ0AV3zhEF0AWrzjUB1AXjzlT91AYjznD51AZnzoz11AavzqTx0Ab7zrztzAdPztDpyAenzuTlxAQD0vjhwARj0wjduATL0xjZsAUz0yjVqAWj0zTRnAYT00TNlAaL01DJiAcD02DFfAeD03DBcAQH13y9YASL14y5VAUX15y1RAWj17CxNAYz18CtIAbH19SpEAdf1+ylAAf71ASk7ASX2Byg2AU72DicxAXb2FiYsAaD2HiUmAcr2JyQhAfX2MSMbASH3OyIVAU33RyEPAXr3UyAJAaf3YB8DAdX3bx78AAP4fh32ADL4jxzvAGH4oBvoAJD4sxriAMD4xxnbAPH43BjUACL58xfMAFP5CxfFAIT5JBa+ALX5PxW3AOf5XBSvABn6ehOoAEz6mRKgAH76uhGYALH63RCRAOP6AhCJABb7KA+BAEn7UA55AHz7eg1xAK/7pgxpAOL71AthABX8BAtZAEj8NgpRAHv8aQlJAK38nwgAAGIKRBHbF00ewCTLKtYwnzZIPPJBm0cmTXRSiVedXLJhkGZta0twDXW2eV9+CIOwh0CMhZDLlBGZKJ1AoVelLKkCrdewmLRYuAS8iL/5wlfGosnuzCfQT9Nl1nvZgdyG33viQOX256zqNu2z7/rxKfRM9jf47/mM+/78//3//v//AABxE0YlGjfvSAFat2pseyGMIZxzq8W6xMnC2IHmY/P//wAAeyH2QrljfYSMpEDD9OH//wAAHCI3ROFk14TNpBTEsOL//wAA9CIoRYVk4oM/o53CTuH//wAAFhHPIYgy5UJBU0VjSHNLg06TUaP8sqjCU9Ko4f7w//8AAAAAwA8AAEIQAABkEAAAdhAAAIgQAACaEABB4CELFRcAAAAIAAAABQAAAAUAAAAFAAAACQBBgCILxhWUAKcAqQCqAKoArQCtAK8AsACwALAAsQCzALUAtQC1ALcAtwC3ALgAuQC5ALkAuQC6AL0AvQC9AL8AvwC/AMIAwgDCAMMAwwDEAMYAxwDIAMkAyQDKAMsAzADMAM0AzQDOANEA0gDSANUA1gDaANwA3QDiAOcA6gDvAAABAAEAAXcAewB7AHsAfQB+AH4AfgCAAIIAggCDAIMAhwCKAIsAXgBeAF8AXwBgAGIAYgBjAF0AXQBfAGAAYABhAGIAZABcAF0AYQBhAGEAYQBiAGIAfQB+AH4AfwB/AIAAgACAAIAAgACBAIEAgQCCAIIAgwAzAgAAAwAAABYAAAAUAAAAAwAAAAMAAACEAAAAdwAAAGYBAABWAAAAxAMAAAAAAACiCLcPRRssJB0xRz0HS29XfWXWcdUMTBDkF2gquTu6QfVM+lWRYIFyEgbPCbEZYSgNNn9Adk6uWnBnGHP2C7EPixY1JzU0aDqsTmtZjWKjcyUIgQ0uFw4i7SxmNU1GOVVnYUlw2Ar9DxUZrSgHO6ZBWVESXcRm43KdCsIPQRYPId034j8/SnVb1GRabzgLdg75Fhor9UK/SZpSm1vZZKBztwuvD70c0ytCMptDcU50WJZos3F+CxoPHheLLlU2yD7lTwdXrmqCdN8Ixw3OGQEmjzLmQwBPSVcaYIJunwjuDNQWeySFKyM9kEi5Us9jRG57D28T9RpELZo02TwfS3hTpmNvbL0K3Q02G/A1JT3tRHpOR1hjZ3lvTgiwDfUT4iYGMRw590y3VFlnsnF+D3EWEh0dJoQ4FEC/SghaH2Pnbn0MjxIzGVIk7jIaOipGk1AbXTBvewzxD2MZ3C/RN6g+tUf6UGRpfXL9BacJhhF0Hiwwjj1vTBpXSWR7cdIHmwt5E5MffTNLPD1HDVQTYL9u4A49EzYa2SfrLtw3GUinT51nHHHpCFoNcxMWIlw+uEYaT/NYxmIacesLZxV6HHgmyDGnOOlIhFzRZRNxPAntDX4VlSVKOu1APUoEUsZmdnL9D1wUsRqYJq8/bkdbUD5c02XIcX0LnA+WF44pfDFzOJ5BwEvDZWVvFw9cFGsb/CQfK54z5k1IVyZiY3MHEhwYrR4MKEMxbTgHTalXWmGdcu4NoBFJG+whMCnhPopGy1fSZQdugRFxFQgdliyHM3k7wU7yVnRnFHT4DOAQ3RmLJj0t0jawUqpa3GfPdNIOURIEG88hnycQP3BMVFSla5lzjgnMDB4XYzHZQF1GhlKHWqRqwnOSCcINPRVwIbU7x01CVSFex2eWcRQK1A7MFZIg8SaDMdtJ4VhqY2xy/QzYEGEYHR7MI3Q4oVT1XNhpoXQKDUMQOh5qK3wxoTkjQtBYR2S9bQAPkxJLHp806jscQ21OUVctai90yAnvD58gVi/GOqNItFSAYH9r8XRyFMYYSyAtLjM7eEG7UMBbXWV7cnkK6g2MF0sqGkjqTx9XfWAgaQR1Lg2wEVYYQCApJbox6kjwUJdlCW+rCi0OgCCiMCA3L0B0SFJW8WJGbJkNMRGZHGckNislMxE7K1fbZkRw+Q1REw0aWCI7KGUxMUy+YHRpwnPaD8QTeBzOJ8wtcDbpPWtITWiVdKYQDhWRGxYjyyegOwBQRFdmZahtTA3pEOUZCh+JJw1DuEzkVuZhUGtVDEgQMxhnJBMqDTQ4PGhNYGDya8cJkQ0KFG8aeyE2OllKplXRZThwJRDuE4EdRiftLUw6G0TaTrNdoGZsE/sX1h6hJTgs1zfpVPJeJ2nTdI4L6A7DGvQjjyqERjdRKluka6lzchSMF2IfqifqK8U5BErmUdlnx3F5FLYaHikTMlk5sEPYTUBXUWYZcFQNmxBkF7YbsyZDR6VU4VxZaZ9xpgmRDHUewDvVQ79K21XAXrpqAnNLE6wW0R8hLjE27jxSQ99LbGfNc7sTFxgfILclfy9LRvBPMFn4Zy5vexMTF2ck7StMM7A6TUSfWJtlcW4RFOQaEStmOidD4UsvVUlfOmlocpEbzB44JfMo0CrbOX5Kq1QtZHNtZxr4G2IhAy4HMN8y80BrUnlgf24XDyImPCu1LBEviDalRgNUiGJFcY0BTwGLApAEgAL9AtEBSwHWAD7/vv15/W/97gI0AmUCJQJ2AjABzP88A5oDuwFvAIoAfACpAA4AkABTAIQAOgBj/hD9ZQNQAYEBRQA4AD4DHf/2/pD+SP5V+6MAfgAc/yIDnAC8AHgAeAE7AJr+0v3S+gL/Nv/r/CgBXAC6/3//Mv2R+yQB4/+J/ecBY/9n/+n+AgBd/qr+3v/+/eH83flR/Z/93v1+/yn/BP9C/sL9x/rPALj/IABnAH79rgPdArsAHQAt/9L8jwDhABQAGAD0/of+VwZtBJsCpAAzAW4BuwAiAD4Ax/7A/Db6Y/vjAdb/2f8+/oL6tf3M/wj9TgFiAMT/DP4Y/t77KwGDAAb/Bf9B/Q0EOAJj/vf+lwY9AlkBQwFiAD0Amv8fAIcAlQBpAm0B2f8iAJ39sQSNBeACYv53/hT+qf7E/uz9EAKsAFoAQgHa/sH+4/33AX8CkQEBAGv/t/9Z/5YAdgA0AdoAeQDDAHH/+/4L/N78gwG0AYIAVf5A/lf9ewCp/wX/j/8SATYBvQH1AWIBEAGNAOP+OQKQAiUAz//7AH7++f5iBFwCXgJQAV8AIgAAAFUAtADPAJH+kv0uBPr/sf9g/6T/d//s/r3+jf5I/fT7lwFmAKr/Kv8e/nn95P/d/p//TP8G/03+7v+0/7T+mgGXAagAGwKbAf4AbwA6AG//yAAeALsAdACDAJH+Jf4NA9H9MQLDAI3/CABY/x4ANwCG/4MAUgD7/+/+zv+I/ZwCBAAgAOb/6f47AaUAxQB5AZsA1/92/7z+k/+X/WgBYgDL/8H+jv8L/67/+wHUAQcBd/97/owCYgHu/x3/Mv55/z0BNQDw/0IAuP+C/5z+pf64/rj/r/5EAZgAXQGpADz/swD+AAQBRQG2/7D/SwDh/w4BEwFXABYBQv7T/jUBRwDn/w7/BAKhAF7/rf9JAeYAyf79/rEA5v8y/lkAAQEGAH7/o/84/sP+I/8y/1/+Sv+2/+oAMAAFAWcB5wACAVUA5v78AG3/Iv/7ADH/uwF7AF/+3P8RAQ//8ACQ/ywAWf9+AIT/s/86AG/+TQGK/1IAfgCXAE/+ZwF+/5r/gwAM/1YAVQAy/p4BEP8QAJEAHAAz/x/+dQElAbj/Uv8+AAMB+P/u/2oB6QC5ACsAFgEbAMEAOgII/70AXAAfAO3+/f/zALAAtgHRAM4Azf9PAG0AqABH/8z+vP+W/YEByv6U/1z/pQA9AGj/m/9k/vT+//7Y/+z/5P9i/9P+DwF8Aa7+kf58/0AAcgB9/x//ZP/8/sH/jP+bALb9Nv/+AOH+sgDjAJb/2v6kACoBnP+5AD0BwQDT/xwAUACp/0/+FgDQ/zAAE/8b/3X/eACU/gwBeP+MAX0AggCn//D+dgAA/7z/Pf7oAY8AW//Q/0L/agDbAC8AswH1AGEASwBe/nkARf86Ajj/of7hAOv/J//qAJH/wgAOAPIAdgCMAHP+YwFpAdP/Pf9AAAAAIBIAAAARAAAQAAAAIBcAAIARAAAIAAAAYBgAAKARAAAIAAAAABkAALARAAAIAAAAoBkAAMARAAAQAAAAQBoAANARAEHSNwu0AchCQl5FcZuBWI8Vnf2l3KyVs7+5x79uxbrKzM/f1IXZE96V4QTlK+gv60XtJO8E8ePyw/Si9oH4YfpA/CD+//8AAJpPCIHLnYG2+8kJ3eXu//8AAM86gGN3igWmSb/11TTr//8AACUvqFcsgNGcFrdb0e7o//8AAFcq8k01bXmMvasJybXl//8AAOUiCkUvZ+GH4aeExoDk//8AAAAA0BsAABIcAAAkHAAANhwAAEgcAABaHABBkDkLFQUAAAADAAAABAAAAAQAAAAFAAAABQBBsDkLpg0+AGcAeAB/AIcAhwCbAKcAqACsAK0AsACzALUAtQC5ALoAxgDHAMsAzQDeAOMA4wDjAOMA4wDjAOMA4wDjAOMANgBMAGUAbAB3AHgAewB9AEQAVQBXAGcAawBwAHMAdABOAFUAVQBlAGkAaQBuAG8AUwBbAGEAYQBhAGQAZQBpAFwAXQBdAF8AYABiAGMAZwDOAQAAAwAAAEAAAABKAAAAYgAAADIAAABhAAAARAAAAHgAAAA1AAAAfwIAAAAAAABVByYSIB75KYw2hEIPT45aZ2dnckwGzgyuG/cmrDOIP4xMoli1ZSVxeQj2DjwZ/iK4Lp456EebVLphi21gDogXGiPgL2E7DEftVIxfXGtrdRgKQxR3HpYqezOVPUlKn1cjZRpwkw53Fsoh3i3yOv9Dp099W3RmP3I7CLMY0yLCL7c5f0W4UH9czWipco0GNgsKFY0fKS5IO+FI9lWpYxFwPwgpDnMbXCnrNilDkVLEXrlrVHV8CaoPhRagJO01zT30S3VXz2J+ctAIFBK5IJkwszsGTPFWz2MQb2B2MAlbDvEXXC7XOA9BqEx7VZ5nsXB7FFAcPinVMyM9/0WVUhNd3mlPc0YRRRrRKNkz/D7RTSpZzWVbcHd3nBGTGCAlIS4DNk4+hUpEVoxk8m/sCckQgyEKNfpAnUorVE9dmWjacTEN1hjwJ7Y48UVAUlVcuGQBbp11URA2F98ffCdiL248304eW55or3K8CdkOABhhJoA+70idUW9cK2UuccMLdxKyGgkpsTCgOKlCVE6xYpltNRAdHDIw5DpSRt5Oq1aTYMtpxXGfC+IRMBm6IMclqTMuTAVXymWycAYQgBZAHgwl+CkUMFU5l0wJYd1uQxNHJL0wUzSQNQ84sD6bTXxeQnEtELseVDM4RWBOdFK8VMJYuFw5a6sPECKyM04/wURxR1xI6UzCWupsXA1rF94rDTsjPo9BYkUzWxJp+nQIDIIa4ShsNYtGP1yyaZpxe3PRdN4L9BUyJEYyc0maTCpOQlFKXXpy8gwUGVYjzjP9PU1ac1yXXqdfO2WNDTMbdyeyOzNQyFrAYaVlcGh3auELOxkxJmAyuz/SSwZeqXIzfEt9OP96/4//NP+l/kj+oP4t/17+VP/H/jsA7wEEA9ECZgJOAbwB4QDyAKEAEAASATQCt/9E/3X+Vf8JA/wBPAV5BLsCxADfAK0AWgAZAOb/EgCFAJf/mP7r/lsDegIpANP9AP1i/Kf9A/xb+5P+4QBrAHYBzv+xAaEBnAAnAKv9i/rG+bD9G/7c/v0AVwAAAPr/5/+n/hD/eADtBLIDpgDr/vEApwCqAK0BBgLKAloC/gCGAFwAaP+8/nb+MQBp/9D+LP1v/V7/j/7d/wMA/v/I/jj/pP8d//IAdAI1AoT/IAQCA2UArP/f/wQAQP/w/gUAjf0v/KMB2AE1AJn/kQBCAaH/4f+c/9H+0P3V+2P+ygIbAQIAIf+R/gsCaAHa/43/egGx/TL9wAEf/u7+tACo/7v9Y/9I/Q/7igEh/un/fADV/xMAj/8U/2T+bf04/wIAu/+q/scANwA6ANz/zf/C//sB+wGrAboBJABZAnP/RAASARIBRAD0//z/RwA//zD+V/6B/pgBywCv/uwAmgHF/+f/q/4//hwA9/9aAEwB8v93/GAA5P0O/6cCxf/AAOj/PAAn/wUA2/+zAOz/NwEHAhIBSAC6/vr7+v7VAHwBUgBIAZsB5P0+AuX+lwC1AG7+6v4Q/5L/Hf/4/qf/Bv/9/uX/agAR/57/ev52AD0AaAAmARQCXADz/zwAF/9PAR0CMwHm/5L/pf8Z/zT+qgDJAGAAjP6EALMB0v7YAOn+1/9KAL4AcAERAUb/oP1j/58ADAAWAfUAMwEZAEX/8P83AB4AXf8kAs3+agD7/xsASgFg/tsBtgEV/2gAiQAVAPv/1P4s/gkCpf6qADj/Jf80AYb/e//bAPD/ZwGcAaf/kf8wAEIBjgCxAOL+gf/Z/8H/1v89/qAANAHH/8EA0P9KAKb+OwDl/xsAK/7r/qj+GgEGAXoAqwAH/xsAAgG8AP3/QwAy/+T+IwGL/6j/I/53ATIAagBjAEr/tgGI/m/+z/93AOn/9v/Q/4z/OP/K/nkASQAHAO0AHv+LADj+jQEjAAMAlP9DAbX/TAHGAJ3/6/8gAAAAcB0AALAcAAAIAAAA8B8AAPAcAAAIAAAAkCAAAAAdAAAIAAAAMCEAABAdAAAIAAAA0CEAACAdAAAIAAAAcCIAADAdAEHixgALwgOpBb0Ktg+TFCIZsB3HId8l9imhLTkxhDSrN6A6lD2JQG1DUkYWSdtLoE5lURtU0VaHWS5c1V58YRRkkGbxaFNrp237b09yo3TrdjJ5bXuofdd/+YEQhByGJ4gzij6MP44/kD+SNZQqlhSY/5nqm9SdtJ+UoXSjVKU1pxWp6qrArJaubLA3sgO0z7WRt1O5FLvNvIW+PcD1waTDU8UCx7HIVsrzy4bNGs+u0DnSxNNP1drWXNjf2WLb5NxO3rnfI+GN4vDjSuWe5urnNulu6qXr1uwG7jfvYfB+8YTyivOK9HX1YPZG9x349PjD+ZH6VvsQ/L38Y/3//X/+//5/////AADrE/4mqDlSTJVes2/QgIKQNKCQr5e+Tc3J2vzn5vT//wAA4ybxTJlw6o+OrubLO+b//wAA9SK3Q3hkhoTlo0PD9eH//wAA/CXSSHZpG4oMqk7J5ef//wAALiJbRIlmkIbnpT7FQuP//wAAGiJ5Q9hkgIUophvEDeL//wAAQSKCRMNm3Yb2pmDGz+P//wAAICLNQnpjdYNvo2nDCOL//wAAEBEfInYyzEIjU3ljdnNzg3CTbKNps2bDC9Nb4lbx//8AQbDKAAsmYCMAAGIkAACEJAAAliQAAKgkAAC6JAAAzCQAAN4kAADwJAAAAiUAQeDKAAslKgAAAAgAAAAEAAAABQAAAAUAAAAFAAAABQAAAAUAAAAFAAAACQBBkMsAC/IDsAC1ALYAtwC6ALoAvwC/AL8AxADFAMkAywDOAM4AzgDPAM8A0QDRANEA0QDSANIA0gDTANMA0wDUANYA2ADYANkA2QDZANkA2gDaANsA2wDcAN0A3gDfAN8A3wDfAOAA4ADgAOEA4QDiAOIA4gDiAOMA4wDjAOMA4wDjAOQA5ADkAOQA5QDlAOUA5gDmAOYA5wDnAOcA5wDoAOgA6ADoAOkA6gDrAOsA6wDsAOwA7ADsAO0A7QDtAO0A8ADwAPAA8ADxAPIA8wD0APQA9wD3APgA+AD4APkA+wD/AP8AAAEEAQQBBQEIAQgBCgEKAQwBDwESARQBFwEgASABIAEgAXYAeAB5AHkAegB9AH0AgQCBAIIAgwCEAIgAiQCKAJEAVwBYAFsAYQBiAGQAaQBqAFwAXwBfAGAAYQBhAGIAYwBYAFwAXwBfAGAAYQBiAG0AXQBdAF0AYABhAGEAYwBlAF0AXgBeAF8AXwBjAGMAYwBdAF0AXQBgAGAAYQBkAGYAXQBfAF8AYABgAGAAYgBjAH0AfQB/AH8AfwB/AIAAgACAAIAAgACAAIEAggCDAIQACgEAAAMAAAAoAAAAAwAAAAMAAAAQAAAATgAAAFkAAABrAAAAjQAAALwAAACSAAAAEAEAAPAAAADrAAAA1wAAAHgCAEGQzwAL9jaSBOYISg7+FPIdmSMiLPgzCzyNRINM71P2XLZlnm75dVwGHgkTEJQXih5IJQEuxTarPQBECkwNU2ZZ9V9aaJttvAZuCtgPhBmlIIcnPS/tNmtAa0nBT4JXu15wZvpuBHXVBWMNtRL/GPMguCfgLvI2ZT8iR0hOUlZZXu9lF26pdV8EKQjHEGUY8yH1KZAx0TqEQmhJ7VDyV7FftGfLb6Z3UwVxCVcPtBX+HGMkZy7HNQ8/WEjqTzJY219EZ55ubnZiBMcJYBTsG14kRit3M9A54EEMSdRP2Ff8X+pni2/adlgCJQWaC+kVDh44JokvBzf7P8pHR1CeWKNgSWjmb5N2rQNaB7IQpBUiIYImpC7PN9s+RUhmT1RYh2AOaI5w3nZ7AqMGGBE8F6EfgyfyL2I37z6VRe9MDVV3XQpldm22dYAFrgjEDe8VsRyRIu0q5DH4O4JC50lGUiFbf2JJal9xvQIbBdwNnRhAHmYl2yuyMkI7nUQ/TVFWpl7fZtluF3bYBjwJDxOpGYUeRCa/K9I3sz1QRqxPkVf0XgxmyG6pd4UDXQYcDRsSWBw/IvMmJi1vO4hEQ0xcVVxdemXlbeh11QOFBvsMVRJFGPQhdimcMms7L0WQTWpWGF/gZzNwEXdHBhEKfBCIFVQhlChrLWc1iD0vQ4BNY1XGW7pku22zdSsDvwVIDLETBh2tJKYrxzM1O2VBf0yXVjNeHmbfbrt2BwZgCC0OyxilHHsk1ikcNfs6vEOGTn5VtFwlZKps3XTsAaEEfAtwFbcbLyJMLQs1rT5fRtJOb1bJXiZnRG+VdgsG6ghtDsUYTh6HJUgutDO0QJVGL02cUy5e7mdycL93rQI6BVENjhQmGwYkliy7ONE/5UXsSzJT/VpdYkVtOHd3Ay0G8QveEBgcqSE/JzIziT/lRQlPTlc7XxBnmm7tde0IoQ4eFpgdayQ4LLczVzsXQxlLdFK8WfVgH2iRb/x22AU8CHgN8hqIILgl9CsXMoM6YkAER3VOsllIYjlsvXM/Au0EFQ/jGWYgOSqhMbA5tEJnSvJRD1qMYU9oMHCJdpIGpQgqD14YKByuJX0qdzTVOVU/FUaJUf5bpWRsbBVzeANQBlQPSxQmHMchcibRLMM+LUd3T/ZYt18sZ5ZtI3QlA64Fewp4EQAfkCSGLAk4TT+oRf1LjlRbXUhl427/dmgGTwmcDdoTkBeeIXgtpjLiPdhDkku+UlZcIWXQblt2YAacCJ4RnB0OIhApui4QNxg9KkPHSudW81/BZ7xvLXf7BzQKkQ/DGmYfKiXjKvUxQjxYQdNJNU92WWFmJ3Cad7AI7gpxEcgUxBvcJOoqpjMHOY1HrU5TVTFcZGQYbnZ3QwMFBvMPiRbaHLck2yqoMK060khrUTxazGJWaRhx1nYDBycJyRIIFwocYSHvJzo0DjlVQGFHAFFdXJFmQG62dsYGzgi/D0QUahnAHrMl4TJTOJlDJ0yuVlNfvmYjbuF1MQctCYAPnBLoGGEmKCshNFo5fD8HR3NTbl0sZn9t73SYBf8H/xUPGwYgyyVeLMI00jkjQKNHA1Y8XkFm4m16d8IGEAmgDsgSdxfCJfUqNjWCO1dEeE7yVTNcOGPzakZy8wR7B2sVnBolIL8mRS0ZNJs5LUZIUJdWx1/DaNNwsnf2BbUIkBDcHPki0ih7LpY13UGTR5tPkFjdYBpp6nCed38I5woIENsapCFGJngv4DQHPRJFDUtEUj5fiGjZbyh2xgHPBPMQahZ+HS4jUCjVNIU+uUVnTuhVjV27ZVVu33XKCOcKhhCjFGoabylnLv01tT1wQz1O+lYMYEVnVG7TdqAGqAjUEMEgJiYWKwwxEzfCP+hE3kpuUJ9d6mh+cGJ3lAmkDBER5hf0Gysj9Sz8MYU9i0MjTOFW0l9qZ3FueXUTB+0J4w1oFaMjHyl2Lls1njsDQqZLTVKmWPpeeGofdREGxgjPEXwVYhrCHtstAzVUO9dFOU/uVyZgGWhycCN4vgfQCvoOTBccIrQmFS7dObc/GkZpUkNZiF/AZgZuO3QgB+EJ6Q5JFcYaCiKNKP4vcjeePURMflOPXNVlwG0EdqQIJgtrDwoXyiYkLTYyxDnIPyRFYU9SVnhcy2Jgaapv5wcnCrgPNBPVGY0rqTAiOcA/nkXZTLRSS1rDZZlwJnhcBp4Iiw0MEechvSdYLm81ljoqQgdLdFMqXQNm3G1Bdt4HKwoSEFYcRCE7Jy4uvzTJP6JF8UwgU29aVWC3aNF1SAmkC0YRihZoG/sldSvMNH08WULYSmtQUV8sanZxt3eWCa4NEBKDF9AdkSIoKow2ozy9QptM9lJIWRRiym3CdCUG4gjsDG8XESN4J6kwsjeFPQRHBk4FUwVa4mFdbGt2lweqCiwQEBhDHRojLSznMeQ5rkD1RS1NCFQ1XIpqV3PlBxYKjhHLFlEbNSBjJo05TkDmRb9MW1LUXCtokHEOeRwE7waSDBoR8h27JPArDzR8OipGFlFSV+9hSWpJcZF3qggyC38Q6BS1GfwmQy1BM1k7x0DSR3BO/VXlYt9tuHRiCBgLLRHQFhkdESIQKaAuGzVlQ25Lm1F5WxtkZWwXdrQHOwqsDt8Y2R1uIv4vyDXNO3RGZUyoUTZYLGGYbOh21QcRCrAQzRxuIe8n+i1aNHZAUEa9THBSzlm2aEFz3niBBB4HjA5DFU4b/iExKHsuIDbTO8FESFKMXONlqm+vdxgFTQf2DBscjSXtKWkwoDXOPUJEwknUUEpaxGMkbDxyLQiDCrIPAhoLH7sjASlpLhA+nUWFS/FSS1uSYqFrLnU/AjMFuBT+GukgZic5Lbo0PEBfSFVQP1lSYURoV3DNdZsF6AfTDDwQux1gKREvZzZjPO1HD1D+Vp5e7WWhbZN1YAZ4CKQVNh22IZcofC3xN309zUNESdJPD1nMZX5v6Hd/BcUITQ0HFsskvSlIL7c0rzy1RxxOuVQfX7ZntXBkd4sGsgilDx8g9yaTKxYy7Dd4QNlGdkw6UudYUGGIbqp3OAROBiYOjR0sIj8owS0YNhE9GkQxTUFVE1wxYw5rh3GdBrUIgA0CESYWiioTMVc3Bz7hQ2lN01UeXhNmim6TdfoHjwtjEGwWwhtLIHYrfToSQndHNFDeVZ9cqWTZa6dy2ANMBuAOkRTlGtsgSyWJKuowiEBdTIdUwlzKZZZupnb0B+oJRhBRHrojrChwLyk15DwRQ39IkU48VflefW2Ud08HMwndDxcUKB2RJ6UumTooQbJH9U0HVx1h+Gg8cZd3BgpZDCMSUxjuHPImYi1oNBE+1EOxSlFRQFiQYD1wanmkBhcJ3BIzF48dwiNPK+MxgTf5Pv5Oj1hIYCBoGHAZeGEMIQ+2E9Qa+B8IJS8w9DaePTNGB0/PVOBbnWKSaTpwHAZXCYUQShrJItso4jK5OnFDYU1ZVb1ckmOwaoVxP3cwC+cNbxIpGXglLyvbMcA5LED0RgZQ9lZ3Xpdm324QdnEKeQ3lEV8Xzxp3ILAwVzZ6PX9F2Eu+UtldwWczcOh2cwnpC7IQ8Bh0Ib0lGCyEMW84qkRoTe9SO1q2YhNp/nD+BNEHuAvpFAsnAS7aMuo4sj5iRQ5OcVRLW/thCGzcdaQDWAbuCtoRkCEEJyAt+jIZQvVIv08aWfFgw2iEcLF2FAmdCzwQRhYHG2YiEyjXMKc6t0DaS39Tn1nmX5BpmXQcBkUJfw0rE1cXDB0KLqk46z7kRjNOlVS8XNZkom+kdtELkQ4CE3gZDyW/KkYwsjcuP11EFEygU7taSmHTat9y9gStB5IaOx/0I0wq2zCWN489xEWRT+ZXOWCSZ3dvPXeiCL0KqhA/HZYmCisXMl84dz/CSOJPJla7XMtiwmnxcfsEhgfqEK0Z+SCoKswzoDofQo1IpFDJVq9dgmPsauVvxwtWDt4T5BjQHl0k1ipiMZ84LD+gRgROtldDYeJqF3VCC5UO+RNSGb0f1SVOLegzLTwoQ9JOmlfhYIZpHHJbePwImAsFEEIVtxjmHqcwJjaDPWFEbUrHUFdYUmBra3F10Qh8C04RZxeCG6wgxiTYK2s9DEQ1S91Ta13FZQ5vsHbLBP0H6g6TE04bDyQQK9MyvUNJSmdQD1lrYvxop3JVeEoFhAfNDo0f1Sh3LSg04TlnQQ1Hf07+VRFgNWjnbzB2RgzRDzUY+RwxIqwnDS19M0s+90SWTJpTv1s7ZNttYHYlBdcIdRK7HcMlci0/N4I/JEnaUGtXx12vZHNqAnGBdyIGEwnqDkcYpSYkLQ4zJzkYP3JHilMyWxpiK2kocNh1+QhBD48YbiGsKd4xqzrOQlxKxVBFVz9dhmPNabNwOHd7B8sJwQ91FpMbpyKjKaYvcTYXPOVBE0mHWtpkYm8ld2QJZgtGFGwYAh2fJmMwyzlyQcBHck/zVaxeWGdKb712VQazCJcN3RPRJFwypjckPTVD8kjeT8FW4lwLZRttjXVNB1YJCRBtG9Ur5zHrNuY8gEKwSHNQO1ZhXEJiImn/b/cJtAxQEqIZvR6lI+soGC4qPFxJAFIbWOFecGVJazBykQqlDX8S2BjhHogkEi12NIc7F0K7SH5OKFUuW3BiSXJ2COcKqw/ZEwgXTiNfNG85n0ANR7hNYVUoYVtpG3Eyd0kHzQtYEoYZlyC6JvUxFzeVQEFFXFOnVylh2mYMb8p1KQ35EK0ZOyJFKMEtNzTAOWNA4UZ/Tf9S/FqFY6NrB3PxBIgIQxXVHl8pUzMBO/9A4kdyTatT01mPYEVny26tdTAG1AfPDWIR1iEMKiAygjpMQmpJxFETWDxgmWcdcGd3Ww2wEcoZ0h4kJXsq4zEVOLM+mkeWUNpX7mE4aRJxTne+BswI9REmG7sgXyZjLPox4jd0PJ5BYkanVM5j9G2fdjkNHg+7FPQY5RvsIZcxWzpgQGVHOVAgVotdbWU2bgR10wrqDGIRuBU1GRUl7DSiOWdBD0g8TuhUwlwJYwVqinHUCzwP2RnVHvsj8CgPLw81TjsWQUZIfE6uViZfvmYdcdAH9gnjD7UanCX6KjIxEjflPCtD90iDThpULVpBYF5xHAvmDO8T2xf/GpYhgDDmNpo+h0jAUP5WkF2rZApsSnXLDx4UZBxgI6QqXjHPODg/HEbrTG1TxVn5YN9nP28Zdj0IQQrgEJUVHh3sJ7QyajnbRD9LBVBtV9desWTHbPp2DgZrCkkZGCXpKkAw4zWBO8tC0kjtT2RWhV6zZvNutHVrCQwMMRASFd8Y2h9FM7E+mUS1SgpT6liLX81mX24GdD8QpBFEF9MdPiAUI8grNTdSP9NF5E5oVSBdk2SabTx16gd/CR0LIg4OH0omsTF8OMBAKEqAUxdbgWFeaCtxsHdlDfkOeBEwEysekii1Mto7O0F3SSpRF1gzYH5nrm4Sd4QSMRSkFlUZVht+IgEuTji/Qe1HNVFhV6xe62SfbEV1lgCoAO//lf9y/xv/wP5q/gn+lP2d/Fn8evxY/XL+jv9y/p3+MQD/AHIABAGPAQgBPQGvAQICEwKzAWQB7gBqANX/3P9X/yD/ef6H/fj8Nvy0/Dn+S//0/1UAVQCkAMMAegBVAGL/gP15/AkABwCE/5UAIADcAHEB8gBzAE8AVABu/yj/uv8ABO8CPgK4AXkBYAHLAB4AEAD9/1EAoQBkAGz/UP+lA+4ClAGrAP7/bv9l/kb+4/3Y/Ub+8/4Q/8z/WwJ7ApUBsgDXABMAZ/9Z/97+Jf+XAA8BlwB3AC8BCgFkAEUA2/5v/asDkwK6AV8BhABiAPD///95/zj/If+n/6cAmgCsAO0A0/9J/xz/Gv4HAWACngCD/3r+Hf+K/ysAN/54/v/8uPwUAIv/Pv9D/1P/U//f/yAArgCQAHMApwA5ACwADgCTAGAAyv9y/3//Av+1/jABNgHM/13+svzc+6j/hf82/6n+1v0//En8RwGfAFEA/wDjAHgAywAAAcAApADgACIBwwDYANEAgABAAwQEeQO6AvgBmAFjAdoAIACN/6z/7P6c/8j+HP6DA6oC0QHIAfEA9P/t/lf+M/6R/t//5P+a/z7/8f1fA4oDzwH1AA0ALP/P/pf/owAXAbAAXQBDAHMAwAA9AM7/fP9R/yD/8f6L/QT/hgTMA34CGAEsAUYBjwBo/yr/4f41ANb/FP+g/ln+CP9//13/Tv+J/1UAOQACAn4BdgGSAagBpwEPAcUAYQAoACcAn/9B/1z/Gv8A/2b+jAFHAX8ACgCJ/1n/3f7u/nP/nf8e/yb/df8g/y//9P5G/mP+3gA6AAkCWAECAUwA1v9y/1v/hf+k/y8ACAD9/0H/9f9c/1n/of4c/TcBGgIjAbgAHQCX/wkA4v/K/+//s//x/mT+kv14/dwBugC+/zv/t/+i//H/LwAcAHAAxv/f/0EAEwBUAFYAFAFyANgBEgMfA3ECnwGyAN3/5v8FAAkAUwAnACUAJwBI/4r+9/6W/gv+UQHMAt4BxP+D/13/agERAIb/F/8XAYoAnQA+AcEAvQDRAAoB/ADS/8j/6/5T/tABggGOACwA1f9CAAgBtgAvAA4A5v+x/zEADwCA/zX/cP4i/kUBGwDqAJsBzQCBAAwAOgB7ADkAqwCJAGAAgADg/4YA9P85AHcAGgDq/1v/DP5D/fD9jP9AAPj/YQD3/17/vv9k/z7/0f7e/av+IgJmAV8ALQBMAA4BkwHNAGQAewAyAMv/cP+S//P/IAAc/37/YQEoATgAjP4D/20BSQAKAN7/df9B/6D/BQAsAKv/Tf9//0D/Cv+r/5L/Zf/U/+X/kQCKAE8AIABs/7/9hv2/AF4A9//d/7P/rP/I/1X/1v7x/g3/ZP+4/hX/tP+A/4f/gQANAOr/IAAtAAj/v//BAK//KwE5AG3/wABb/57+sv6W/2T/2P/9/7z/fAD//k4AfACqAJwB4wBpAJj/DACaAPoAEgECAQQA5f/rAJgAMwBSASwBBwDG/mX+1wCqAPf/o/+z/0wAQwA2AMgAOwGjAEgApf9u/p4AuwBk/6X/IgELAacAWwCMAKsAcAAJANb/T/9I/oEBUAAPAKwAgQApAH//jP7o/7X/4v9W/woAiv85AE4Am//oAKEAewAAARUBZQBA/4v9nP/E/xj/QgANAPP/sP8R/+8AJQAgAFkAwf69/cIBaAEDAOP/1f6n/8r/kv8K/1z/BgBE/1IBsACk/8UAiQCGAAwA/v84AEn/cgDc/33/NP9LAOf/Uv+/APH/3v5T/vX+TwAlAGoAFwCA/qkBRgDy/9QAaQAPAP7/1v/b/4X/bAAcAND/wQDFAK0A3/8lAEkAx/8AAYkAxv9S/hz/2QDN//b/xv/6/xYAaAA9AIn/qQCQABAA0v92/jwAxgGw/9b+v/8ZAAAA6P+//1/+0QEUAf3/Pv/z/4IAEwD6/+v/6P9M/8v/q/8UAHYAkwBxALX/3/7iAIb/4wAOAX0AbQDFAH0AigAsADwAGQDJ/1n/4P91/z//U//E/h8BMP/9AO8AGwCw/0T/5P9K/xX/nACL/4AA0P/G/x7/rAC1AKcAEwA+AAoAAgC1AJcAbADw//X/sv+1/psBhQARAGgAQABI/xgA4v/9/+X+eQDMAPj/Of/r/7D/V/9j/0H/eP9RAJsADgB9//QASgDH/9H/6P5bAW8As/+A/3L/Pv+D//r/vP9bAAEAFwAOAGb/3v8XANr/qf73AZIA2v/S/9f/OgAfAD8A0P+L/y0AHAABAKf/+//U/+P/QP7nAcwAUQAuAJb/0v58AXgA2v/0/9n/RgD9/xkAv/8eAPX/IgDx/xYAjf8AALH/rf8tAHIAKwCWACQA6QCVAMMABQAZAMz/Jf4SARwA2f/4/77/Af8CATgAjwDT/0L/pQDE/xQAAgB9AH//MwD4/7H+IAEmADsAGQDW/xcAiv+Q/wsAyf97/5P/GACX/04AwP8L/8oAv/+B/6IAKACi/1kAq/+J/5n/YQAJALr/5P/CAFYAkP+k/47/SgDP/y4ArP9O/3EANAAz/00BWADeADgAyf8NAFYABACz/+AAcgCX/3AAfQDj/+7/cP8WAMb/nf8cAHIAvv/g/1f/xv4dAUgAtv+zABwAsf9K/w0Ayf+TAA0ADADK/x8ArP/v/7X/HP9TAIn+tAFuAMH/5f94/6kAyP/4/1X/uADW/5QARADMAOsAbgAb/1sAqwDV//3/5v+d/5H/RwBW/8oAvf+1ANv/bQCI/wMAyf/8/vD/mABbAI4AKgAsAIYALwARAN3/FgBPAFf/KQAuABUBo//P/4L/JQCZ/97/6v+m/3r/M/9cAPf/AQA9/xH/LQA2ABIA6f///7D/nv/s//v+MgFIABQAp/8n/wsABgCu/1kADQB//6f/UwC5/8n/ggCe/27/5f/H/zUAEwERAKoA+//K/4QAwP9IAKAAg/9Y/0gAKACqAE4A+AB0ABQAVAAfAN7/vgAmAA0Alv/hABsAWP8YAGP/hv+lAAsAX/8r//T/zf+b/yoAZQAbADcAbwBLAEcAoP///0EA6/6JAeb/1P+8/6z/vv+h/+sAswDn/9f/GwCl/4D/Iv+SALj/4v/o/zcAgv+8/8b/gf8NAJ//lv+uAJz/mwBlAG7/6/8FARYAJgC+/0EABABGAEAAkAA7ANUARwCv/i8BzP8zAMj/AQAKAPH/+/8iADQA5ACDAKEAgf8q/+4AewBAAG3/zv/e/4H/zACiAFUAKQAFAHT/SQBq/zgAoP++/+z/AgAV/zsA6v+V/5YA8P/R//z/UQC9/6cAlQCVAGP/IAFk/+X/+P8SAFMA6P/X/1n/ngCc/10ANQDJAA8AKgAKARYB9P/6/9v/VQAGABQARP/x/msA8/+w/zMAygCtALv/TgBE/y4ABACZAAwAdv+pAAUAxv+F/5T/Df+WAAoAQf/2APH/JgAZAPb/DgA9ADIAMv8p/yT/WgAFAGv/Jf84AI4AGACI/k0AsP9LAAYAKgCb/xAAOAAOAMf/AwDv/1AAOQDc/1gAxf+f/+3/bP8uACX/4gByAPz/uP/x/yUAz//k//cALAB7AC8Ahv/a/xEABACP/+D/IP+aAHr/xABHAPX+q/8cALr/WQCI/2MA/v9AAEwAWv/Q/70A3f+k/1f/hf9TASYA5/8mAN3/4QB1/87/wf/2ADwAR/+T/8//y/9Z/zMAlQA8AJv/3/8ZALT/eAAgAOL/rf9mAFsARv/7/oMAO/+AAAAAkCcAAJAlAAAQAAAAkDcAAJAmAAAIAAAAkDkAALAmAAAIAAAAkDoAAMAmAAAIAAAAkDsAANAmAAAIAAAAkDwAAOAmAAAIAAAAkD0AAPAmAAAIAAAAkD4AAAAnAAAIAAAAkD8AABAnAAAQAAAAkEAAACAnAEGShgEL4gGbSk1pr3fChaqS/50XqbWzPb3JwlTIwc3X0rXXedyz36niGOVg53jpWOs57Rrv+vDb8rv0nPZ9+F36Pvwe/v//AACIcHeX0bZJyk7aEuhs9P//AADwau+W/K8JyZjYjeaC9P//AAB7gpGaLrApwx/TZ+Jc8f//AAD7ZFyp1Lrsy5zaFegr9P//AADlhZGdeLGHxDbUO+Od8f//AAACg7mb9rCcwxXVbuTP8v//AAA1a7qJ2Z74s6LI3Nye7v//AABAVjt4yZBNqNG+VdXl6v//AABpNPRUfnVXlS+1Y8976P//AEGAiAELJhBDAABSQwAAZEMAAHZDAACIQwAAmkMAAKxDAAC+QwAA0EMAAOJDAEGwiAELJQUAAAACAAAAAgAAAAIAAAACAAAAAgAAAAIAAAADAAAAAwAAAAQAQeCIAQuSAjkAYgCFAIYAigCQAJEAkwCYALEAsQCyALUAtwC4AMoAzgDXANoA3gDjAOMA4wDjAOMA4wDjAOMA4wDjAOMA4wAmAFcAYQB3AIAAhwCMAI8AKABRAGsAawCBAIYAhgCPAB8AbQByAHgAgACCAIMAhAArAD0AfAB9AIQAiACNAI4AHgBuAHYAeACBAIMAhQCFAB8AbABzAHkAfACCAIUAiQAoAGIAcwBzAHQAdQB7AHwAMgBdAGwAbgBwAHAAcgBzAEkAXwBfAGAAYABpAGsAbgCUAAAAAwAAADwAAABEAAAAdQAAAFYAAAB5AAAAfAAAAJgAAACZAAAAzwAAAJcAAADhAAAA7wAAAH4AAAC3AAAAGAMAQYCLAQv2Gh0F9AvPE1QbRCO6KoYyKzolQqZJOFHsWLFgI2jSbyV38AS5CgISCBleIDsnNC8cN/Y+80Z/TpRWyF7MZqluK3YUBCAIWA47FOQbjCM+KwkzPzx+RdtNVVbiXvlmU2/SdmsErAl+EQUY3h6TJqIu8TX9PUJF7E3LVNFcv2Mia/VwEATUB7oP1BfwIP4oQjFmOZ1BV0k/Uf5YxGA6aNdvNHcGCeQOGRf9HjEnaS49NrY9V0V4TOpT7FpFYoJpoXCfd+YEHwuVE30asiGCKLYxKTmZP7xFnk3gU9pZNWBWaDhtvAXzC3sTchslIqwo+S/ENmI+O0W4TBJUsFs9ZFJtEXZ7CO4N5RXYHLwk1CvmMqY5L0HxR3pPS1b3XWRmxG69dmkJRBJ3HTommyyHMiA4JT3WQ/9JGlHNV3hf12Z8biJ2Mgl+EKQakyNMLW42ZT4SRdZKJVDnVXxbWmI4aXpwP3crBW4JWBCXF24dtiRbKykzzzlDQAJIl1HCW+5kjm0RdlEFqwygFz8h+SpZM+E64EDORrVLsFFPWFRgLGj3b2Z3wARYCg0X5iA1J6EsrTILOS5BqEhLUI9Xgl+oZi5ufXVxCdAPrBjxIA4p1THgOo9DdUz/UyFbzmB7ZilsHnJjePQDKQl/E9Ec+SSMLtg3tkDwSEBQFFceXUdjqmmwcFd3kQdtDnsYUx+EKKIvzzcpPRdEsEkhUb5W5V13Y/dqum+xB+kMmRNGGrcgCSdyLeAz5jpvQSBIl07HVTJdcGZycq4EVwo0Ff8cLyZ7L0k52D/JRk5NNVQ/WaRfjmT3aydwZAYZDUcVrR1tJn8tjDaTPsZFlE4vV+VdbmW2bdp0Pnp0CgkQ6hgfIEonHS0QM3U4VD7LQ/NJsk+nVkxddWRLbF0FIQphEQEWhBzpIAIlQirhMWo9Okq1U4JcRGXnbX12PAZvDAIV/BveIXknziwiMqc2wjoCQe9FF1HDYnpsIHb1B5MPXRi1H+Im1S+JNxQ+b0WSTipXVmXBZnNnrGiRb4UIEg+AFvQeOSc5Lck1VD0VRKdNH1zaX3xiXWQQcCt3yAcqD0oZyx6lJIAxBDhVPRJBqEVyUWVZZWBZZ0tv/HZXCZQPSBUIHQYrIzFUM0I3Gj6gSHBS0VlhYDJq7m2sc7EG7hNNG3Ye3iF+J8oxITpFQedHnk5bVnVeVmZNbrl1TAYhDgQYpyBoJQgtWDqRRW9HKUk5SndSN2DkZ0Rws3faCEgQth5KJZIl5yWWJ0k2iT8ASGtQTViyYHJpxXF4eDAHTQ+AGIEe8iWuLMc1tz0sS9RVxFmMWqtcMmS9cW15sgUcDngXQB1jJnUuBjd2PSBET0yYV79gPnLodDR343ia/4f/4f/6/wUA/v8IAO7//P8GAA4A/v/0//D/9P/E/4L/n/7C/Vv9b/2X/Q7+d/6k/uv+H/9c/5r/uv/h/yEABAB7AYMBJwJdAmwCFALiAboBxgGBAVsBQgErAQoByACQBLcDoAL2ADwAX//9/hb/A//m/jX/Rf9l/1D/Ov9O/woAqgCJAWECKwLQALb+xf3//If9wf7V/18AaQBqAHQAaP90/4P/BQCtABIBCAFLAdv/2/6f/e78QfzS/Hv9Ev+l/yQA9f+b/+n+Hf/Y/1oAEgKlAnoDUATnA0MDNAInAej+lP6s/rX+5P4gAfkCcAPcA3MCkgAe/zX/S/9y/ycAGADm/5X/pP9f/3n/ff+o/2D/ZP+1/9X/3P/6/9//IQC8/mH+lP98AJ0AvwDLAMUAkABtAJgAsAC+AHoAZQCfAJcCnALgAZABewG8Ab4BygFXAV8BNgHkAIUALABLAD8ArP8nAOP/IwCi/xf/+/6e/k0ABgHo/2//s/5n/mz+q/0Y/tT+jgNQApwBeACCAM3/2/+z/1T/S/9h/2z/uP/C//4BBAJxALf9zftD/F/+Pf8JAAcAqP9T/6X/NgBiAF8A5P/FAPH9k/2dAHoAWP+TADUBLAFQATsBjAGYAXgBagBe/1b/xf5iADUDjAM6At//yP7I/cT9hv6V/xcAnABdAH//qf8UALj/2/8oABUAGwAwAEsATQBBAC4ARwBCAC8AiABYAewAQgGqABsBDQEjAaIA1f80//3+EP/P/qL+yP6/AVwBWQEBAUcAff+z/0L/Nv/Y/yMAhQAFAW0BtgEvAfj/FgCMAIkA1P5//QT99P7p/+f/SQBe/2r/LP+4/wYAJwBOAGgAo//M/nj/dQC5///9zPxE/T7+X//p/x0ATgBRAWoAav7y/JD/6QB/AT4Agv8GALP/4/9u/4X/zf/l/+X/g/5//ZIBGwIIADH/kv7c/+X/NP8d/xP/Q//A/zMApP93/+f+PgDpAFwAlAAmAWsBoAE0AnECcgHc/yv+Mv5mAKgAIAB1AOv/YQCLAFkAaAAjAAQAUgBCADoASQBdALT/wP4U/0P/Nf9y/+X/t/8JAPf/5/8MAPH/BAAEAM7/OgG0AKIAz//HAJT/Hf++/0H+vf/4/nb+BQA3AHv/UP+M/w//EAFtABoBBgHAAMD/eP7+/ZwAywCaAEgA3v9g/7f/AwDf/1H+QQESAMn9sv2U/1gAQgAzAOH/P//S/0EA4//p/9cA4f9lAI//IAAwAVgAQAHAAQUASf7O/QT+ef/z/1X/+P+2AJ3/S/9r/3gB3AFAAHT+dP1q/7AA3gBBALL9zwIPAY8B9QBIAGT/aP9Q/zsAXgB9APf/+f8JAAEAw/+M/67/AQBPABYA1P/x/9D/v//C/5v/mv/K/7r/sv+w/+f/jgFHAIsAJgBaAMIA3gD5AKUAXgDdAAYBowBbADL/PQLIAOH+bf8FAO7/q/+2/4P/qf9VAI0ABAD8/xwA6gAwAGr/kf8G/u0AL/9ZAV4AhP9NAHkAjwAMALD/0P+/AJAAo/+//2n/ff2zAWoAVwAHAEEAZgBeAEQABQBjAN4AXQBeAGMB8/+n/xz/Cf4fAW0AbADBAf0A4/+T/4z/DwC3/+z/gwBt/0gAOwBq/679EQE8AYQAxwBqAMYA1ADcAFIALQDz/98AiQAOASYA/ACHAE//Mf+Y/pr/kwGWAfL/UwBAADMA+f+d/5//qP+E/7//KgAgABwAHQAMABQAdwDm/yz/N/91AfsAjQBnACQAzP9CABIA+v+h/zz/BQBiAKv/lP/aAFz/FABkAawAJQAKARcAcADo/53/pP9O/x0A6v6EAcT/JP8sAfP/mgC/AA8A2/+S/2f/av+O//n/ov/h/8L/T/8EALr/IwDFAZMACf+4/mUAFACO/5MAbACJ/5P/mv8S/zcAmv+tAKf/gQCKALb+YP/lAZoAxf9W/+z/3v/7/tj/f/9NAKz/RQBTAKAAqQA/APz9HgBQATQAAADM/4T/ngATAMUA9v+J/pUBHQFyAHX+0f/EAD4AVwCW/7//tf+7//P/IgBjADsAUwBiACwAAAAYABIAEQBGAOr/wgDQAJAAsf/x/yAAmP/k/5f/Rv8s/xz/sf+0/zMAuf9IAHYA3v/9/1X/BQACAJT/g/8+AMb/OgCH/0kALv5cAD8Aov+y/7T/1AAkAB//uf+e/pgAjwCx/wr/zf/h//r/8v7wANIAHgBj/xn/SgBu/1gA7/6cAFwAOABHAAIAPgGkACAAkv/d/9f/of+W/wsAhAC8/zcAewCt/2v/1ACEAAAAPv83AM4AlP+f/iEBPf8BAOkA6v/E/xQAGgBEAKYAGwDG/4IAcABrABsAW/9zAKP/2/8mAFMA4wFBABv/8/+dAFUAMgCIAAoAIABTAFIANwAFAPf/zP+y/6//zf8oABIAgf8g/9f/NQAu/4//GADv/0X/p/8IAHkAUwBNAFsAtv/d/5D/X/9T/2YAhACD/8P/ZwD8/jQApgDg/2T/qf/I/zwAuv+E//IAcgAF/1r/yQB/ABwA9f8XALD/jf/s/83/pP5UAd7/hQANAFwAhP94/4j/5v/6/xEAHAAVAHgAWP+gAN3/cwAcAAkABwDI/ycAnAAAAe7/AQAVAVIAuv9w/6j/8//F/2P/CAB6/xUA2P86AOv/wgDs/mEAFwHI/3T/fQA5AEj/NP+6//7/gAA2/7L/5gDp/6EAmv8BAAEAtADh/6r/Wf/H/8T/GwDz/2MAbABvAEwARQAiAOv/NQAmACIATgBJANsAMwAPALj/mf8x/x4A1QDy/x8Aov/Y/3D/QwAEAGkAOwAQ/xkA9ABFADoAFwDo//v/8f97/7n/vf+1AB0A0/95AGAAMwC4/8v/OABn/+X/VQC3ANMAaQDe/9L/KwC4/6P/JACA/x0AbwCh/2T/Tf8V/xUA2f+5/9//w/8E/+YAff+dAOv/q//k/4X/UABg/z8ALwD6/8//oP/t/xEAxv8RAAAA8/9W/xkA3f87AAoA4f9j/lEAPgASAFz/9QBcAFv/KgAaAH4ACP/BAMn/EAAnAA4AMgAgAAAAgEUAAGBEAAAIAAAAgEkAAKBEAAAIAAAAgEoAALBEAAAIAAAAgEsAAMBEAAAIAAAAgEwAANBEAAAIAAAAgE0AAOBEAAAIAAAAgE4AAPBEAAAIAAAAgE8AAABFAAAIAAAAgFAAABBFAAAIAAAAgFEAACBFAEGEpgELrgFAHwAAKCMAAPgqAADIMgAAgD4AAPBVAACghgEAAAAAABAnAADgLgAAsDYAAGhCAAAIUgAAYG0AAKCGAQAAAAAA+CoAALA2AABoQgAACFIAAJBlAACgjAAAoIYBAAAAAADIMgAAgD4AADhKAACoYQAAAH0AALCzAACghgEAEwAAAB8AAAAjAAAAJwAAACsAAAAvAAAANgAAAEAAAAC8NAAAjDwAAFxEAAAAAAAALEwAQcCnAQumAQpn8g5WzeQdCmfyDnVSggxZmgQZdVKCDEYRMQrtA2IURhExCtoC1wf5xq0P2gLXByK2UgXa+qQKIrZSBQAAAABG8y4eK+NLDh9mgBgcLB0K2mFIEu2c9AbsMBML45ClBO2kHQIK32sDAAAAAAAAAABPL0wmKyC8G18YvRWeE98RahAtDxwOLw1fDKgLBAtyCu4JdgkJCaYISwj2B6kHYQceB+AGpgYAQfCoAQs5/v8GAP//BQD//wUA/v8HAPz/CAD//wYA//8GAPz/CQD3/wwA/f8HAP7/BwD5/w0AEAAYACIACQAFAEGyqQELFOTAv9Su3EXkxerz8An2Qvo3/f//AEHSqQELgAHKYr53fovCnbmnwrBjuQPBlMjuzvXUqNpP4PHlfevj8K/1U/nU/P//AAAAAAAAAABeE98kDTXmRJNUt2F5bU92ln4ahpCN8pRum0GhDKfFrGyy6bcvvQvCocbcyubOxdKY1j3a1d1s4YjkleeL6nztZvAK85f1+/dM+kf8Jv7//wBB4KoBCxQaAOwAQQFFAVMBWAFqAXsBnAGiAQBBgKsBC/QBWADnAO0A9AAsATUBOQFEAUUBVQFaAV8BYAFgAWIBZAFvAYkBjAGWAQAAAAAAAAAA7gD4AP8AAQECARIBHAE3AT0BRgFGAUcBUwFdAV4BXwFgAWMBZgFuAXMBewF/AYMBhAGJAYoBigGXAZkBnAGcAZ0BpgGqAbABsgHBAcYBxwFgVQAAgFUAALBVAAAAAAAAUgLYAxgL/QOdAgoAIwAwAf//FwBK/YMH+xGfCx8JhQloDMIOlAfhAdYA0v++HjYR9/2A/NISNSFXBon8SP1qDFAZ0v45BAUCVwLqAzcCMALl9778aBKs/oADmwV8/ZkPnP3x9wBBgK0BC4QFdwZmC4kTwgvvBnEAxgBYA7AAsgC1/K8Jsh77FD4COwDsFOAdIgvF/gAP8xJ/GS8GL/tUBuAGGglUB/0H3/0+BxAuCwbN/qT9sQL5FNITqRAJAs36ZSZBGEX73fpbGskmfvoiAnUAcP/6CnEGeBQQFZQNeQna/3kCDgA//poU2w1V/57/iwGaI4wGTAN0/AMPnSJD/MIFjAFbGgMVt/71BLH+Dgu5EA4Byv/eBekV/iKdFwsIjv7fAZMUXhaWBHUUiPtuGccBAAIAAAAAAAAAAOr+nwGBJMIbUf4S/BcPNCV0Epn8RvwQEsotzQPU/ov/mhuLIKcHe/xRAlQNthcyEx8GNgDN/0oxhBC0/FUM1hJtFAkJzQIM/4kEdjcLA0UAPvvjFV4yA/fpA3z/eA82JUECDgef+W8i9Chs9n8D6wDCAdsEmwK1Ab8DuvWRKkQixPh0Cf4HvSJLEd/5FwCzG6Qg+/rkBZP7QwPuHZsX8Aq3AYcBCCvNCFIFBPw8C3w0rw809CQEfvXINL0Vjvp0+kcfnSxo/3j5g/xPC0o8LvqfAOL7rAGwL1oh8PLsBuj6qR0pGDECDQJJ+wMajytu+7cBawqHEjcJixWHCwgd5R4a/+T5uP9cCGUVbwUsBtwB4PooPn4I/ftpFrkBvQn7B8UK5ADV/wsHBxqYG/QR3iN9Bzj/ywBA/QcvSxVc+x4C9gbw+14nWR0x9b71Qx47Iz4ArgbrABf/igupKpsHZir+CtAEkf/eANsI2golMJwAhvl69J8fyj8MAdbxQwAjCA4fsP+A9gYCvv+2Bp8BqywKAAAAFAAAACgAAAAAAAAAmXlmZgBAMzNmJpoZMxPMDD0KmgkAQZGyAQuDBCAAAP4fAAD2HwAA6h8AANgfAADCHwAAqB8AAIgfAABiHwAAOh8AAAofAADYHgAAoB4AAGIeAAAiHgAA3B0AAJAdAABCHQAA7hwAAJYcAAA6HAAA2BsAAHIbAAAKGwAAnBoAACoaAAC0GQAAOhkAALwYAAA8GAAAthcAAC4XAACgFgAAEBYAAH4VAADoFAAAThQAALATAAAQEwAAbhIAAMgRAAAeEQAAdBAAAMYPAAAWDwAAZA4AAK4NAAD4DAAAQAwAAIQLAADICgAACgoAAEoJAACKCAAAxgcAAAIHAAA+BgAAeAUAALIEAADqAwAAIgMAAFoCAACSAQAAygAAAAAAAAA2////bv7//6b9///e/P//Fvz//077//+I+v//wvn///74//86+P//dvf//7b2///29f//OPX//3z0///A8///CPP//1Ly//+c8f//6vD//zrw//+M7///4u7//zju//+S7f//8Oz//1Ds//+y6///GOv//4Lq///w6f//YOn//9Lo//9K6P//xOf//0Tn///G5v//TOb//9bl//9k5f//9uT//47k//8o5P//xuP//2rj//8S4///vuL//3Di//8k4v//3uH//57h//9g4f//KOH///bg///G4P//nuD//3jg//9Y4P//PuD//yjg//8W4P//CuD//wLg//8A4P//AEGgtgELlAMeAIwAGgG8ATACcQKOAqUC2wIMAxMDTANbA8ADgAMABMADAATAAzUDVABnAKQA/ABeAboBDgJfApcC2wITA1sDmwObA8ADAATAAwAEAARrA7EAdQB4AKIA5wBAAaoBHQKRAiMDQAPAA4ADAASbAwAEAAQABMADAAQTAbYAkgCQAKYAzwAFAUIBhAHCAQQCRgJ9AsYC+gI1A0ADgAObA94CxAEvAdgAqgCZAJ4AtgDcABIBUQGWAekBQwKpAoADKwOAA8ADmwMABH0AkwCqAMoA6AAJAScBTAFwAZYBuwHjAQgCMwJeAoYCwALjAvUC4wEdAegAyAC+AMEAzgDgAPQACgEhATsBVAFvAYoBqQHOAfABGwIxAl4BYwKsAT8B8gDKALIArAC0AMcA5QAMATkBbAGmAeIBGgJbAqsC4wJKAvUBwgFsATQBCAHnANQAzADMANIA3gDxAAkBJwFGAWoBkQG1AdUBQQEAAAAAAAAAAEIBpwDHAKQA7wCyAJ0A5wAwAbwAiQCZAKsAzAAdASkB7QBmAQBBwrkBC0Dsf///AAAhJabb//8AAP0PzH0Y8f//AADtCE8/br7A9///AACtBuYkGn3I2YT5//8AAFcGShtVVUWxC+e6+v//AEGSugELZrN///8AAO4xEM7//wAA7xKZf+Pt//8AAMQJmUN1u4n3//8AADMHWSijfonYFfv//wAAzQWWG9lTlqnH5m/8//8AAAAA6RLNOTd8A8J97/////8AAAAAAABgH79UdqD92////////wBBgrsBC64BZ3///wAAbzjgxv//AACdGEt/4ef//wAA3gvQSNm2hPX//wAA0gYcKf1+6dcW+///AADSBNgYC1PAqgPpJf3//wAA/ANtEc42Hn4xyNDxTP7//wAAUwNrDRYnyVpdn5TYIfbk/v//AAAAABsI4RvfQgt7hrdj5ej5/////wAAAAAAAOwONC3+WZ2TAcs77////////wAAAAAAAAAA4hq8Qex2LK8V4P//////////AEG6vAELwgJtJ7NZe5ea1P////////////8AAAAAAABEfv//AADgO2HB//8AADIdWH5j4v//AABoD/pLNLGx8f//AAAiCbIts36b0vb4//8AAOIFohsSVdyn7eVO/P//AAADBIoRLzgIfiTHEPET/v//AAD4As4L4CXgWvmhddsV9+P+//8AAEMC0AjZGhVBz3x6vAvoxvpQ////AADQAfcGPRTtL7dexZvy0D7wT/yC////AABuATQFKA85JJlIDn1os1PdmPSD/cv///8AAB4BKQQRDDkbRDcbYYKVG8bG5tj3Q/7J////AAAAAOIB2ge2FKgoLErqd3Kq2dOc7Xf6CP//////AAAAAAAA7gPLDbEe8DnfX7CNu7kz3nfz6vz///////8AAAAAAAAAAEcHVhPqKVRL1XKmoW/Ma+la+f//////////AEGGvwELGtEJehyXONNe8ImgtCHaN/L/////////////AEGsvwELGhYOZSVMSftvHJ1ayBTq////////////////AEHUvwELQQ8TIzNQW92M88Cz5///////////////////AAAAAAAAAwAHAAwAEgAZACEAKgA0AD8ASwBYAGYAdQCFAJYAqAC7AEGgwAEL2ALQk1CQm43oiZuHr4rhhviF4IQrupGvB6YrnamWPp3bk3uR846SqVmsd6gSoL2X8Z1slaOTHY8X507ZXsrJu+yvIL1Rq7amuqAGAAAAgBsAAPARAADADwAAwBAAAOAQAAAGAAAAECMAAEAdAADQGwAAcBwAAJAcAAAKAAAAkEIAAEAnAABgIwAAMCUAAGAlAAAKAAAAgFIAADBFAAAQQwAAAEQAADBEAACkwF4fQB+AwUAfAcEEH0AfgMFAH1XBsx5AH4DBQB/zwR4eQB+AwUAf5mAAANxgAADSYAAAAAAAAMhgAADqYAAA4GAAANZgAAAA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AAEAAQAAAAAA/////wAAAAAAAAAA9//5//r/+//7//z//P/9//3//v/+//7/////////AAAAAAAAAQABAAAAAQACAAIAAgADAAMABAAEAAUABgAFAAYACAD9//7//v/+//////////////8AAAAA//8AQcjYAQtBAQAAAAAAAAABAAEAAAABAAEAAgABAAIAAgACAAIAAwADAAMAAgACAAIAAgABAAIAAQABAAAAAQABAAAAAAAAAAEAQZbZAQuCAf//AAAAAP/////////////+//7//v8JAAgABgAFAAYABQAEAAQAAwADAAIAAgACAAEAAAABAAEAAAAAAAAA/////////v/+//7//f/9//z//P/7//v/+v/5/wAA1QetMTlPYHqKjfiymeGA9v//AABpIcFbv4zXtA/Rx9wP57n6//8AQaLaAQv7CAm4PfBO/GX+/f5I/3//qv/C/9D/3f/k/+r/7P/w//H/8//0//b///8AAABnkLqz5W32N/xZ/jX/kP/C/9r/5//t//D/8//1//b/+P/5//r///8AAIElbm01s3rfYPRj/Oz+p//c/+f/7//x//X/9v/5//r/+//8//7///8AABcNrjB0ZWab/sUs4VXwIfj6+/H95/5f/6H/v//Q/9n/4f/l/+j///8AAOgBgAtPJABNoH3Iq4HPCOc29NX6+P1C/77/5//r//X/+f/7//7///8AAHVCxXZsnw682tBO38Xp0vCZ9cT43/o//Cv9v/0b/lf+d/6N/p/+//8AALILgyDlPYReLH6smVSwlcLi0B3cluQH69XvafP59bL34/ii+Tj6//8AAFgA0QLrCnYdKDpkXyGHiKscyYLejuwo9SX6zPwt/u7+Tv92/4z///8AAB8BFQMQCC4R7h/eNLdO02rlhk+hirhmy9zZWuTd6+/wRfSF9h/4//8AAAEAAwBbAKkRdDmpbuOjlMsH5CHxLvjL+5z9RP6M/p7+rv6z/rv+//8AAECc//8gAGQAZAAAAQAAJHEAAOBuAADccAAATjEwX19jeHhhYml2MTE2X19zaGltX3R5cGVfaW5mb0UAAAAAJHEAABBvAADUbgAATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAAAAAAAAAFBvAAARAAAAEgAAABMAAAAUAAAAFQAAACRxAABcbwAA1G4AAE4xMF9fY3h4YWJpdjEyM19fZnVuZGFtZW50YWxfdHlwZV9pbmZvRQA8bwAAjG8AAHYAAAA8bwAAmG8AAGIAAAA8bwAApG8AAGMAAAA8bwAAsG8AAGgAAAA8bwAAvG8AAGEAAAA8bwAAyG8AAHMAAAA8bwAA1G8AAHQAAAA8bwAA4G8AAGkAAAA8bwAA7G8AAGoAAAA8bwAA+G8AAGwAAAA8bwAABHAAAG0AAAA8bwAAEHAAAHgAAAA8bwAAHHAAAHkAAAA8bwAAKHAAAGYAAAA8bwAANHAAAGQAAAAkcQAARHAAAARvAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAU3Q5ZXhjZXB0aW9uAAAAAAAAAIxwAAAOAAAAFgAAABcAAAAkcQAAmHAAAERxAABTdDExbG9naWNfZXJyb3IAAAAAALxwAAAOAAAAGAAAABcAAAAkcQAAyHAAAIxwAABTdDEybGVuZ3RoX2Vycm9yAAAAAOxwAAAMcQAAAAAAAARvAAARAAAAGQAAABMAAAAUAAAAGgAAABsAAAAcAAAAHQAAAFN0OXR5cGVfaW5mbwAAAAAAAAAAOHAAABEAAAAeAAAAEwAAABQAAAAaAAAAHwAAACAAAAAhAAAA7HAAAGlwAAAAAAAARHEAACIAAAAjAAAAJAAAAAAAAAAlAAAAJQAAACYAAAAmAAAAJgAAACYAAAAmAAAAJgAAACUAAAAlAAAAJgAAACUAAAAlAAAAJQAAACUAQcDjAQsdJgAAACYAAAAlAAAAJQAAAAAAAAAlAAAAAAAAACYAQeTkAQsFwHUBABA=";
function _silkEmbedded(module, exports, require, __filename) {
"use strict";var __create=Object.create;var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __getOwnPropNames=Object.getOwnPropertyNames;var __getProtoOf=Object.getPrototypeOf,__hasOwnProp=Object.prototype.hasOwnProperty;var __export=(target,all)=>{for(var name in all)__defProp(target,name,{get:all[name],enumerable:!0})},__copyProps=(to,from,except,desc)=>{if(from&&typeof from=="object"||typeof from=="function")for(let key of __getOwnPropNames(from))!__hasOwnProp.call(to,key)&&key!==except&&__defProp(to,key,{get:()=>from[key],enumerable:!(desc=__getOwnPropDesc(from,key))||desc.enumerable});return to};var __toESM=(mod,isNodeMode,target)=>(target=mod!=null?__create(__getProtoOf(mod)):{},__copyProps(isNodeMode||!mod||!mod.__esModule?__defProp(target,"default",{value:mod,enumerable:!0}):target,mod)),__toCommonJS=mod=>__copyProps(__defProp({},"__esModule",{value:!0}),mod);var index_exports={};__export(index_exports,{decode:()=>decode,encode:()=>encode,getDuration:()=>getDuration,getWavFileInfo:()=>getWavFileInfo2,isSilk:()=>isSilk,isWav:()=>isWav});module.exports=__toCommonJS(index_exports);var import_meta_url=require("url").pathToFileURL(__filename).href;var Module=async function(moduleArg={}){var moduleRtn,g=moduleArg,aa,q,ba=new Promise((a,b)=>{aa=a,q=b}),ca=typeof window=="object",da=typeof WorkerGlobalScope<"u",t=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&process.type!="renderer";if(t){let{createRequire:a}=await import("module");var require2=a(import_meta_url)}var u=(a,b)=>{throw b},ea=import_meta_url,v="",fa,w;if(t){var fs=require2("fs"),ha=require2("path");ea.startsWith("file:")&&(v=ha.dirname(require2("url").fileURLToPath(ea))+"/"),w=a=>(a=y(a)?new URL(a):a,fs.readFileSync(a)),fa=async a=>(a=y(a)?new URL(a):a,fs.readFileSync(a,void 0)),process.argv.slice(2),u=(a,b)=>{throw process.exitCode=a,b}}else if(ca||da){try{v=new URL(".",ea).href}catch{}da&&(w=a=>{var b=new XMLHttpRequest;return b.open("GET",a,!1),b.responseType="arraybuffer",b.send(null),new Uint8Array(b.response)}),fa=async a=>{if(y(a))return new Promise((d,c)=>{var e=new XMLHttpRequest;e.open("GET",a,!0),e.responseType="arraybuffer",e.onload=()=>{e.status==200||e.status==0&&e.response?d(e.response):c(e.status)},e.onerror=c,e.send(null)});var b=await fetch(a,{credentials:"same-origin"});if(b.ok)return b.arrayBuffer();throw Error(b.status+" : "+b.url)}}console.log.bind(console);var A=console.error.bind(console),C,D,E=!1,ia,ja,F,G,H,I,J,ka,la,ma,na,y=a=>a.startsWith("file://");function pa(){var a=D.buffer;ja=new Int8Array(a),G=new Int16Array(a),F=new Uint8Array(a),H=new Uint16Array(a),I=new Int32Array(a),J=new Uint32Array(a),ka=new Float32Array(a),na=new Float64Array(a),la=new BigInt64Array(a),ma=new BigUint64Array(a)}var K=0,L=null;function qa(a){throw g.onAbort?.(a),a="Aborted("+a+")",A(a),E=!0,a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info."),q(a),a}var ra;async function sa(a){if(!C)try{var b=await fa(a);return new Uint8Array(b)}catch{}if(a==ra&&C)a=new Uint8Array(C);else if(w)a=w(a);else throw"both async and sync fetching of the wasm failed";return a}async function ta(a,b){try{var d=await sa(a);return await WebAssembly.instantiate(d,b)}catch(c){A(`failed to asynchronously prepare wasm: ${c}`),qa(c)}}async function ua(a){var b=ra;if(!C&&typeof WebAssembly.instantiateStreaming=="function"&&!y(b)&&!t)try{var d=fetch(b,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(d,a)}catch(c){A(`wasm streaming compile failed: ${c}`),A("falling back to ArrayBuffer instantiation")}return ta(b,a)}class va{name="ExitStatus";constructor(a){this.message=`Program terminated with exit(${a})`,this.status=a}}var wa=a=>{for(;0<a.length;)a.shift()(g)},xa=[],ya=[],za=()=>{var a=g.preRun.shift();ya.push(a)},O=!0;class Aa{constructor(a){this.I=a-24}}var Ba=0,Ca=0,Da,P=a=>{for(var b="";F[a];)b+=Da[F[a++]];return b},Q={},R={},S={},T=g.BindingError=class extends Error{constructor(a){super(a),this.name="BindingError"}},Ea=a=>{throw new T(a)};function Fa(a,b,d={}){var c=b.name;if(!a)throw new T(`type "${c}" must have a positive integer typeid pointer`);if(R.hasOwnProperty(a)){if(d.K)return;throw new T(`Cannot register type '${c}' twice`)}R[a]=b,delete S[a],Q.hasOwnProperty(a)&&(b=Q[a],delete Q[a],b.forEach(e=>e()))}function U(a,b,d={}){return Fa(a,b,d)}var Ga=(a,b,d)=>{switch(b){case 1:return d?c=>ja[c]:c=>F[c];case 2:return d?c=>G[c>>1]:c=>H[c>>1];case 4:return d?c=>I[c>>2]:c=>J[c>>2];case 8:return d?c=>la[c>>3]:c=>ma[c>>3];default:throw new TypeError(`invalid integer width (${b}): ${a}`)}},Ha=[],V=[],Ia=a=>{9<a&&--V[a+1]===0&&(V[a]=void 0,Ha.push(a))},Ja=a=>{if(!a)throw new T(`Cannot use deleted val. handle = ${a}`);return V[a]},Ka=a=>{switch(a){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let b=Ha.pop()||V.length;return V[b]=a,V[b+1]=1,b}};function La(a){return this.fromWireType(J[a>>2])}var Ma={name:"emscripten::val",fromWireType:a=>{var b=Ja(a);return Ia(a),b},toWireType:(a,b)=>Ka(b),H:8,readValueFromPointer:La,G:null},Na=(a,b)=>{switch(b){case 4:return function(d){return this.fromWireType(ka[d>>2])};case 8:return function(d){return this.fromWireType(na[d>>3])};default:throw new TypeError(`invalid float width (${b}): ${a}`)}},Oa=a=>{for(;a.length;){var b=a.pop();a.pop()(b)}};function Pa(a){for(var b=1;b<a.length;++b)if(a[b]!==null&&a[b].G===void 0)return!0;return!1}var Sa=(a,b)=>{if(g[a].F===void 0){var d=g[a];g[a]=function(...c){if(!g[a].F.hasOwnProperty(c.length))throw new T(`Function '${b}' called with an invalid number of arguments (${c.length}) - expects one of (${g[a].F})!`);return g[a].F[c.length].apply(this,c)},g[a].F=[],g[a].F[d.J]=d}},Ta=(a,b,d)=>{if(g.hasOwnProperty(a)){if(d===void 0||g[a].F!==void 0&&g[a].F[d]!==void 0)throw new T(`Cannot register public name '${a}' twice`);if(Sa(a,a),g[a].F.hasOwnProperty(d))throw new T(`Cannot register multiple overloads of a function with the same number of arguments (${d})!`);g[a].F[d]=b}else g[a]=b,g[a].J=d},Ua=(a,b)=>{for(var d=[],c=0;c<a;c++)d.push(J[b+4*c>>2]);return d},Va=g.InternalError=class extends Error{constructor(a){super(a),this.name="InternalError"}},Wa=[],Xa,Ya=(a,b)=>{a=P(a);var d;if((d=Wa[b])||(Wa[b]=d=Xa.get(b)),typeof d!="function")throw new T(`unknown function pointer with signature ${a}: ${b}`);return d};class Za extends Error{}for(var ab=a=>{a=$a(a);var b=P(a);return W(a),b},bb=(a,b)=>{function d(f){e[f]||R[f]||(S[f]?S[f].forEach(d):(c.push(f),e[f]=!0))}var c=[],e={};throw b.forEach(d),new Za(`${a}: `+c.map(ab).join([", "]))},cb=(a,b)=>{function d(h){if(h=b(h),h.length!==c.length)throw new Va("Mismatched type converter count");for(var l=0;l<c.length;++l)U(c[l],h[l])}var c=[];c.forEach(h=>S[h]=a);var e=Array(a.length),f=[],m=0;a.forEach((h,l)=>{R.hasOwnProperty(h)?e[l]=R[h]:(f.push(h),Q.hasOwnProperty(h)||(Q[h]=[]),Q[h].push(()=>{e[l]=R[h],++m,m===f.length&&d(e)}))}),f.length===0&&d(e)},db=a=>{a=a.trim();let b=a.indexOf("(");return b===-1?a:a.slice(0,b)},eb=typeof TextDecoder<"u"?new TextDecoder:void 0,fb=(a=0,b=NaN)=>{var d=F,c=a+b;for(b=a;d[b]&&!(b>=c);)++b;if(16<b-a&&d.buffer&&eb)return eb.decode(d.subarray(a,b));for(c="";a<b;){var e=d[a++];if(e&128){var f=d[a++]&63;if((e&224)==192)c+=String.fromCharCode((e&31)<<6|f);else{var m=d[a++]&63;e=(e&240)==224?(e&15)<<12|f<<6|m:(e&7)<<18|f<<12|m<<6|d[a++]&63,65536>e?c+=String.fromCharCode(e):(e-=65536,c+=String.fromCharCode(55296|e>>10,56320|e&1023))}}else c+=String.fromCharCode(e)}return c},gb=typeof TextDecoder<"u"?new TextDecoder("utf-16le"):void 0,hb=(a,b)=>{for(var d=a>>1,c=d+b/2;!(d>=c)&&H[d];)++d;if(d<<=1,32<d-a&&gb)return gb.decode(F.subarray(a,d));for(d="",c=0;!(c>=b/2);++c){var e=G[a+2*c>>1];if(e==0)break;d+=String.fromCharCode(e)}return d},ib=(a,b,d)=>{if(d??=2147483647,2>d)return 0;d-=2;var c=b;d=d<2*a.length?d/2:a.length;for(var e=0;e<d;++e)G[b>>1]=a.charCodeAt(e),b+=2;return G[b>>1]=0,b-c},jb=a=>2*a.length,kb=(a,b)=>{for(var d=0,c="";!(d>=b/4);){var e=I[a+4*d>>2];if(e==0)break;++d,65536<=e?(e-=65536,c+=String.fromCharCode(55296|e>>10,56320|e&1023)):c+=String.fromCharCode(e)}return c},lb=(a,b,d)=>{if(d??=2147483647,4>d)return 0;var c=b;d=c+d-4;for(var e=0;e<a.length;++e){var f=a.charCodeAt(e);if(55296<=f&&57343>=f){var m=a.charCodeAt(++e);f=65536+((f&1023)<<10)|m&1023}if(I[b>>2]=f,b+=4,b+4>d)break}return I[b>>2]=0,b-c},mb=a=>{for(var b=0,d=0;d<a.length;++d){var c=a.charCodeAt(d);55296<=c&&57343>=c&&++d,b+=4}return b},nb=0,ob=[],pb=a=>{var b=ob.length;return ob.push(a),b},qb=(a,b)=>{var d=R[a];if(d===void 0)throw a=`${b} has unknown type ${ab(a)}`,new T(a);return d},rb=(a,b)=>{for(var d=Array(a),c=0;c<a;++c)d[c]=qb(J[b+4*c>>2],`parameter ${c}`);return d},sb=(a,b,d)=>{var c=[];return a=a.toWireType(c,d),c.length&&(J[b>>2]=Ka(c)),a},X={},tb=a=>{ia=a,O||0<nb||(g.onExit?.(a),E=!0),u(a,new va(a))},ub=a=>{if(!E)try{if(a(),!(O||0<nb))try{ia=a=ia,tb(a)}catch(b){b instanceof va||b=="unwind"||u(1,b)}}catch(b){b instanceof va||b=="unwind"||u(1,b)}},vb=Array(256),Y=0;256>Y;++Y)vb[Y]=String.fromCharCode(Y);Da=vb,V.push(0,1,void 0,1,null,1,!0,1,!1,1),g.count_emval_handles=()=>V.length/2-5-Ha.length,g.noExitRuntime&&(O=g.noExitRuntime),g.printErr&&(A=g.printErr),g.wasmBinary&&(C=g.wasmBinary);var Ab={u:(a,b,d)=>{var c=new Aa(a);throw J[c.I+16>>2]=0,J[c.I+4>>2]=b,J[c.I+8>>2]=d,Ba=a,Ca++,Ba},v:()=>qa(""),l:(a,b,d)=>{b=P(b),U(a,{name:b,fromWireType:c=>c,toWireType:function(c,e){if(typeof e!="bigint"&&typeof e!="number")throw e===null?e="null":(c=typeof e,e=c==="object"||c==="array"||c==="function"?e.toString():""+e),new TypeError(`Cannot convert "${e}" to ${this.name}`);return typeof e=="number"&&(e=BigInt(e)),e},H:8,readValueFromPointer:Ga(b,d,b.indexOf("u")==-1),G:null})},o:(a,b,d,c)=>{b=P(b),U(a,{name:b,fromWireType:function(e){return!!e},toWireType:function(e,f){return f?d:c},H:8,readValueFromPointer:function(e){return this.fromWireType(F[e])},G:null})},m:a=>U(a,Ma),k:(a,b,d)=>{b=P(b),U(a,{name:b,fromWireType:c=>c,toWireType:(c,e)=>e,H:8,readValueFromPointer:Na(b,d),G:null})},c:(a,b,d,c,e,f,m)=>{var h=Ua(b,d);a=P(a),a=db(a),e=Ya(c,e),Ta(a,function(){bb(`Cannot call ${a} due to unbound types`,h)},b-1),cb(h,l=>{var k=[l[0],null].concat(l.slice(1));l=a;var p=a,z=e,n=k.length;if(2>n)throw new T("argTypes array size mismatch! Must at least get return value and 'this' types!");var B=k[1]!==null&&!1,M=Pa(k),Qa=k[0].name!=="void";z=[p,Ea,z,f,Oa,k[0],k[1]];for(var x=0;x<n-2;++x)z.push(k[x+2]);if(!M)for(x=B?1:2;x<k.length;++x)k[x].G!==null&&z.push(k[x].G);M=Pa(k),x=k.length-2;var r=[],N=["fn"];for(B&&N.push("thisWired"),n=0;n<x;++n)r.push(`arg${n}`),N.push(`arg${n}Wired`);r=r.join(","),N=N.join(","),r=`return function (${r}) {
`,M&&(r+=`var destructors = [];
`);var Ra=M?"destructors":"null",oa="humanName throwBindingError invoker fn runDestructors retType classParam".split(" ");for(B&&(r+=`var thisWired = classParam['toWireType'](${Ra}, this);
`),n=0;n<x;++n)r+=`var arg${n}Wired = argType${n}['toWireType'](${Ra}, arg${n});
`,oa.push(`argType${n}`);if(r+=(Qa||m?"var rv = ":"")+`invoker(${N});
`,M)r+=`runDestructors(destructors);
`;else for(n=B?1:2;n<k.length;++n)B=n===1?"thisWired":"arg"+(n-2)+"Wired",k[n].G!==null&&(r+=`${B}_dtor(${B});
`,oa.push(`${B}_dtor`));Qa&&(r+=`var ret = retType['fromWireType'](rv);
return ret;
`);let[yb,zb]=[oa,r+`}
`];if(k=new Function(...yb,zb)(...z),p=Object.defineProperty(k,"name",{value:p}),k=b-1,!g.hasOwnProperty(l))throw new Va("Replacing nonexistent public symbol");return g[l].F!==void 0&&k!==void 0?g[l].F[k]=p:(g[l]=p,g[l].J=k),[]})},b:(a,b,d,c,e)=>{if(b=P(b),e===-1&&(e=4294967295),e=h=>h,c===0){var f=32-8*d;e=h=>h<<f>>>f}var m=b.includes("unsigned")?function(h,l){return l>>>0}:function(h,l){return l};U(a,{name:b,fromWireType:e,toWireType:m,H:8,readValueFromPointer:Ga(b,d,c!==0),G:null})},a:(a,b,d)=>{function c(f){return new e(ja.buffer,J[f+4>>2],J[f>>2])}var e=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][b];d=P(d),U(a,{name:d,fromWireType:c,H:8,readValueFromPointer:c},{K:!0})},n:(a,b)=>{b=P(b),U(a,{name:b,fromWireType:function(d){for(var c=J[d>>2],e=d+4,f,m=e,h=0;h<=c;++h){var l=e+h;(h==c||F[l]==0)&&(m=m?fb(m,l-m):"",f===void 0?f=m:(f+="\0",f+=m),m=l+1)}return W(d),f},toWireType:function(d,c){c instanceof ArrayBuffer&&(c=new Uint8Array(c));var e,f=typeof c=="string";if(!(f||ArrayBuffer.isView(c)&&c.BYTES_PER_ELEMENT==1))throw new T("Cannot pass non-string to std::string");var m;if(f)for(e=m=0;e<c.length;++e){var h=c.charCodeAt(e);127>=h?m++:2047>=h?m+=2:55296<=h&&57343>=h?(m+=4,++e):m+=3}else m=c.length;if(e=m,m=wb(4+e+1),h=m+4,J[m>>2]=e,f){if(f=h,h=e+1,e=F,0<h){h=f+h-1;for(var l=0;l<c.length;++l){var k=c.charCodeAt(l);if(55296<=k&&57343>=k){var p=c.charCodeAt(++l);k=65536+((k&1023)<<10)|p&1023}if(127>=k){if(f>=h)break;e[f++]=k}else{if(2047>=k){if(f+1>=h)break;e[f++]=192|k>>6}else{if(65535>=k){if(f+2>=h)break;e[f++]=224|k>>12}else{if(f+3>=h)break;e[f++]=240|k>>18,e[f++]=128|k>>12&63}e[f++]=128|k>>6&63}e[f++]=128|k&63}}e[f]=0}}else F.set(c,h);return d!==null&&d.push(W,m),m},H:8,readValueFromPointer:La,G(d){W(d)}})},e:(a,b,d)=>{if(d=P(d),b===2)var c=hb,e=ib,f=jb,m=h=>H[h>>1];else b===4&&(c=kb,e=lb,f=mb,m=h=>J[h>>2]);U(a,{name:d,fromWireType:h=>{for(var l=J[h>>2],k,p=h+4,z=0;z<=l;++z){var n=h+4+z*b;(z==l||m(n)==0)&&(p=c(p,n-p),k===void 0?k=p:(k+="\0",k+=p),p=n+b)}return W(h),k},toWireType:(h,l)=>{if(typeof l!="string")throw new T(`Cannot pass non-string to C++ string type ${d}`);var k=f(l),p=wb(4+k+b);return J[p>>2]=k/b,e(l,p+4,k+b),h!==null&&h.push(W,p),p},H:8,readValueFromPointer:La,G(h){W(h)}})},f:a=>{U(a,Ma)},p:(a,b)=>{b=P(b),U(a,{L:!0,name:b,H:0,fromWireType:()=>{},toWireType:()=>{}})},s:()=>{O=!1,nb=0},i:(a,b,d,c)=>(a=ob[a],b=Ja(b),a(null,b,d,c)),d:Ia,h:(a,b,d)=>{b=rb(a,b);var c=b.shift();a--;var e=`return function (obj, func, destructorsRef, args) {
`,f=0,m=[];d===0&&m.push("obj");for(var h=["retType"],l=[c],k=0;k<a;++k)m.push(`arg${k}`),h.push(`argType${k}`),l.push(b[k]),e+=`  var arg${k} = argType${k}.readValueFromPointer(args${f?"+"+f:""});
`,f+=b[k].H;return e+=`  var rv = ${d===1?"new func":"func.call"}(${m.join(", ")});
`,c.L||(h.push("emval_returnValue"),l.push(sb),e+=`  return emval_returnValue(retType, destructorsRef, rv);
`),a=new Function(...h,e+`};
`)(...l),d=`methodCaller<(${b.map(p=>p.name).join(", ")}) => ${c.name}>`,pb(Object.defineProperty(a,"name",{value:d}))},q:a=>{9<a&&(V[a+1]+=1)},g:a=>{var b=Ja(a);Oa(b),Ia(a)},j:(a,b)=>(a=qb(a,"_emval_take_value"),a=a.readValueFromPointer(b),Ka(a)),t:(a,b)=>{if(X[a]&&(clearTimeout(X[a].id),delete X[a]),!b)return 0;var d=setTimeout(()=>{delete X[a],ub(()=>xb(a,performance.now()))},b);return X[a]={id:d,M:b},0},w:a=>{var b=F.length;if(a>>>=0,2147483648<a)return!1;for(var d=1;4>=d;d*=2){var c=b*(1+.2/d);c=Math.min(c,a+100663296);a:{c=(Math.min(2147483648,65536*Math.ceil(Math.max(a,c)/65536))-D.buffer.byteLength+65535)/65536|0;try{D.grow(c),pa();var e=1;break a}catch{}e=void 0}if(e)return!0}return!1},r:tb},Z=await async function(){function a(c){return Z=c.exports,D=Z.x,pa(),Xa=Z.D,K--,g.monitorRunDependencies?.(K),K==0&&L&&(c=L,L=null,c()),Z}K++,g.monitorRunDependencies?.(K);var b={a:Ab};if(g.instantiateWasm)return new Promise(c=>{g.instantiateWasm(b,(e,f)=>{c(a(e,f))})});ra??=g.locateFile?g.locateFile?g.locateFile("silk.wasm",v):v+"silk.wasm":new URL("silk.wasm",import_meta_url).href;try{var d=await ua(b);return a(d.instance)}catch(c){return q(c),Promise.reject(c)}}(),$a=Z.z,wb=Z.A,W=Z.B,xb=Z.C;function Bb(){function a(){if(g.calledRun=!0,!E){if(Z.y(),aa(g),g.onRuntimeInitialized?.(),g.postRun)for(typeof g.postRun=="function"&&(g.postRun=[g.postRun]);g.postRun.length;){var b=g.postRun.shift();xa.push(b)}wa(xa)}}if(0<K)L=Bb;else{if(g.preRun)for(typeof g.preRun=="function"&&(g.preRun=[g.preRun]);g.preRun.length;)za();wa(ya),0<K?L=Bb:g.setStatus?(g.setStatus("Running..."),setTimeout(()=>{setTimeout(()=>g.setStatus(""),1),a()},1)):a()}}if(g.preInit)for(typeof g.preInit=="function"&&(g.preInit=[g.preInit]);0<g.preInit.length;)g.preInit.shift()();return Bb(),moduleRtn=ba,ba.catch(()=>{}),moduleRtn},silk_default=Module;function isWavFile(fileData){try{let chunks=unpackWavFileChunks(fileData),fmt=decodeFormatChunk(chunks.get("fmt")),data=chunks.get("data");return getWavFileType(fmt),verifyDataChunkLength(data,fmt),!0}catch{return!1}}var audioEncodingNames=["int","float"],wavFileTypeAudioEncodings=[0,0,0,1];function decodeWavFile(fileData){let chunks=unpackWavFileChunks(fileData),fmt=decodeFormatChunk(chunks.get("fmt")),data=chunks.get("data"),wavFileType=getWavFileType(fmt),audioEncoding=wavFileTypeAudioEncodings[wavFileType],wavFileTypeName=audioEncodingNames[audioEncoding]+fmt.bitsPerSample;return verifyDataChunkLength(data,fmt),{channelData:decodeDataChunk(data,fmt,wavFileType),sampleRate:fmt.sampleRate,numberOfChannels:fmt.numberOfChannels,audioEncoding,bitsPerSample:fmt.bitsPerSample,wavFileTypeName}}function unpackWavFileChunks(fileData){let dataView;fileData instanceof ArrayBuffer?dataView=new DataView(fileData):dataView=new DataView(fileData.buffer,fileData.byteOffset,fileData.byteLength);let fileLength=dataView.byteLength;if(fileLength<20)throw new Error("WAV file is too short.");if(getString(dataView,0,4)!="RIFF")throw new Error("Not a valid WAV file (no RIFF header).");let mainChunkLength=dataView.getUint32(4,!0);if(8+mainChunkLength!=fileLength)throw new Error(`Main chunk length of WAV file (${8+mainChunkLength}) does not match file size (${fileLength}).`);if(getString(dataView,8,4)!="WAVE")throw new Error("RIFF file is not a WAV file.");let chunks=new Map,fileOffset=12;for(;fileOffset<fileLength;){if(fileOffset+8>fileLength)throw new Error(`Incomplete chunk prefix in WAV file at offset ${fileOffset}.`);let chunkId=getString(dataView,fileOffset,4).trim(),chunkLength=dataView.getUint32(fileOffset+4,!0);if(fileOffset+8+chunkLength>fileLength)throw new Error(`Incomplete chunk data in WAV file at offset ${fileOffset}.`);let chunkData=new DataView(dataView.buffer,dataView.byteOffset+fileOffset+8,chunkLength);chunks.set(chunkId,chunkData);let padLength=chunkLength%2;fileOffset+=8+chunkLength+padLength}return chunks}function getString(dataView,offset,length){let a=new Uint8Array(dataView.buffer,dataView.byteOffset+offset,length);return String.fromCharCode.apply(null,a)}function getInt24(dataView,offset){let b0=dataView.getInt8(offset+2)*65536,b12=dataView.getUint16(offset,!0);return b0+b12}function decodeFormatChunk(dataView){if(!dataView)throw new Error("No format chunk found in WAV file.");if(dataView.byteLength<16)throw new Error("Format chunk of WAV file is too short.");let fmt={};return fmt.formatCode=dataView.getUint16(0,!0),fmt.numberOfChannels=dataView.getUint16(2,!0),fmt.sampleRate=dataView.getUint32(4,!0),fmt.bytesPerSec=dataView.getUint32(8,!0),fmt.bytesPerFrame=dataView.getUint16(12,!0),fmt.bitsPerSample=dataView.getUint16(14,!0),fmt}function getWavFileType(fmt){if(fmt.numberOfChannels<1||fmt.numberOfChannels>999)throw new Error("Invalid number of channels in WAV file.");let bytesPerSample=Math.ceil(fmt.bitsPerSample/8),expectedBytesPerFrame=fmt.numberOfChannels*bytesPerSample;if(fmt.formatCode==1&&fmt.bitsPerSample>=1&&fmt.bitsPerSample<=8&&fmt.bytesPerFrame==expectedBytesPerFrame)return 0;if(fmt.formatCode==1&&fmt.bitsPerSample>=9&&fmt.bitsPerSample<=16&&fmt.bytesPerFrame==expectedBytesPerFrame)return 1;if(fmt.formatCode==1&&fmt.bitsPerSample>=17&&fmt.bitsPerSample<=24&&fmt.bytesPerFrame==expectedBytesPerFrame)return 2;if(fmt.formatCode==3&&fmt.bitsPerSample==32&&fmt.bytesPerFrame==expectedBytesPerFrame)return 3;throw new Error(`Unsupported WAV file type, formatCode=${fmt.formatCode}, bitsPerSample=${fmt.bitsPerSample}, bytesPerFrame=${fmt.bytesPerFrame}, numberOfChannels=${fmt.numberOfChannels}.`)}function decodeDataChunk(data,fmt,wavFileType){switch(wavFileType){case 0:return decodeDataChunk_uint8(data,fmt);case 1:return decodeDataChunk_int16(data,fmt);case 2:return decodeDataChunk_int24(data,fmt);case 3:return decodeDataChunk_float32(data,fmt);default:throw new Error("No decoder.")}}function decodeDataChunk_int16(data,fmt){let channelData=allocateChannelDataArrays(data.byteLength,fmt),numberOfChannels=fmt.numberOfChannels,numberOfFrames=channelData[0].length,offs=0;for(let frameNo=0;frameNo<numberOfFrames;frameNo++)for(let channelNo=0;channelNo<numberOfChannels;channelNo++){let sampleValueFloat=data.getInt16(offs,!0)/32768;channelData[channelNo][frameNo]=sampleValueFloat,offs+=2}return channelData}function decodeDataChunk_uint8(data,fmt){let channelData=allocateChannelDataArrays(data.byteLength,fmt),numberOfChannels=fmt.numberOfChannels,numberOfFrames=channelData[0].length,offs=0;for(let frameNo=0;frameNo<numberOfFrames;frameNo++)for(let channelNo=0;channelNo<numberOfChannels;channelNo++){let sampleValueFloat=(data.getUint8(offs)-128)/128;channelData[channelNo][frameNo]=sampleValueFloat,offs+=1}return channelData}function decodeDataChunk_int24(data,fmt){let channelData=allocateChannelDataArrays(data.byteLength,fmt),numberOfChannels=fmt.numberOfChannels,numberOfFrames=channelData[0].length,offs=0;for(let frameNo=0;frameNo<numberOfFrames;frameNo++)for(let channelNo=0;channelNo<numberOfChannels;channelNo++){let sampleValueFloat=getInt24(data,offs)/8388608;channelData[channelNo][frameNo]=sampleValueFloat,offs+=3}return channelData}function decodeDataChunk_float32(data,fmt){let channelData=allocateChannelDataArrays(data.byteLength,fmt),numberOfChannels=fmt.numberOfChannels,numberOfFrames=channelData[0].length,offs=0;for(let frameNo=0;frameNo<numberOfFrames;frameNo++)for(let channelNo=0;channelNo<numberOfChannels;channelNo++){let sampleValueFloat=data.getFloat32(offs,!0);channelData[channelNo][frameNo]=sampleValueFloat,offs+=4}return channelData}function allocateChannelDataArrays(dataLength,fmt){let numberOfFrames=Math.floor(dataLength/fmt.bytesPerFrame),channelData=new Array(fmt.numberOfChannels);for(let channelNo=0;channelNo<fmt.numberOfChannels;channelNo++)channelData[channelNo]=new Float32Array(numberOfFrames);return channelData}function verifyDataChunkLength(data,fmt){if(!data)throw new Error("No data chunk found in WAV file.");if(data.byteLength%fmt.bytesPerFrame!=0)throw new Error("WAV file data chunk length is not a multiple of frame size.")}function getWavFileInfo(fileData){let chunks=unpackWavFileChunks(fileData),chunkInfo=getChunkInfo(chunks),fmt=decodeFormatChunk(chunks.get("fmt"));return{chunkInfo,fmt}}function getChunkInfo(chunks){let chunkInfo=[];for(let e of chunks){let ci={};ci.chunkId=e[0],ci.dataOffset=e[1].byteOffset,ci.dataLength=e[1].byteLength,chunkInfo.push(ci)}return chunkInfo.sort((e1,e2)=>e1.dataOffset-e2.dataOffset),chunkInfo}function ensureMonoPcm(channelData){let{length:numberOfChannels}=channelData;if(numberOfChannels===1)return channelData[0];let monoData=new Float32Array(channelData[0].length);for(let i=0;i<monoData.length;i++){let sum=0;for(let j=0;j<numberOfChannels;j++)sum+=channelData[j][i];monoData[i]=sum/numberOfChannels}return monoData}function ensureS16lePcm(input){let int16Array=new Int16Array(input.length);for(let offset=0;offset<input.length;offset++){let x=~~(input[offset]*32768);int16Array[offset]=x>32767?32767:x}return int16Array.buffer}function toUTF8String(input,start=0,end=input.byteLength){return new TextDecoder().decode(input.slice(start,end))}function binaryFromSource(source){return ArrayBuffer.isView(source)?source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength):source}async function encode(input,sampleRate){let instance=await silk_default({wasmBinary: globalThis.__SILK_WASM__, locateFile: () => "silk.wasm"}),buffer=binaryFromSource(input);if(!buffer?.byteLength)throw new Error("input data length is 0");if(isWavFile(input)){let{channelData,sampleRate:wavSampleRate}=decodeWavFile(input);sampleRate||=wavSampleRate,buffer=ensureS16lePcm(ensureMonoPcm(channelData))}let data=new Uint8Array,duration=instance.silk_encode(buffer,sampleRate,output=>{data=output.slice()});if(duration===0)throw new Error("silk encoding failure");return{data,duration}}async function decode(input,sampleRate){let instance=await silk_default({wasmBinary: globalThis.__SILK_WASM__, locateFile: () => "silk.wasm"}),buffer=binaryFromSource(input);if(!buffer?.byteLength)throw new Error("input data length is 0");let data=new Uint8Array,duration=instance.silk_decode(buffer,sampleRate,output=>{output.length>0&&(data=output.slice())});if(duration===0)throw new Error("silk decoding failure");return{data,duration}}function getDuration(data,frameMs=20){let buffer=binaryFromSource(data),view=new DataView(buffer),byteLength=view.byteLength,offset=view.getUint8(0)===2?10:9,blocks=0;for(;offset<byteLength;){let size=view.getUint16(offset,!0);blocks+=1,offset+=size+2}return blocks*frameMs}function isWav(data){return isWavFile(data)}function getWavFileInfo2(data){return getWavFileInfo(data)}function isSilk(data){let buffer=binaryFromSource(data);return buffer.byteLength<7?!1:toUTF8String(buffer,0,7).includes("#!SILK")}0&&(module.exports={decode,encode,getDuration,getWavFileInfo,isSilk,isWav});

}


// 测试与协议实测入口(不影响 Obsidian 加载)
WechatDiaryPlugin.__internals = {
  detectIntent, normalizeIntent, extractExplicitName, validateName, foldRepeats,
  countMessages, isMessageBlock, lastHeaderTime,
  todayStr, hhmmStr, weekdayForDate, yesterdayStr, setTimezone,
  ILinkClient, respCode,
  parseImageAesKey, sniffImageExt, decryptAesEcb,
  INTENT, texts: { HELP_TEXT, NIGHT_SIGNOFF_TIP, FIRST_OF_DAY_PREFIX, FIRST_OF_DAY_TIPS, FIRST_OF_DAY_TIPS_NIGHT, FINALIZE_EMPTY_REPLY, FINALIZE_FAIL_REPLY, GRACE_EXPIRED_NOTICE, CLOSING_MARKER },
  pingReply, welcomeText, undoOkReply, logicalTodayStr, setDayStartHour, isNightNow, canMergeIntoLastHeader,
  isUndoPhrase, signoffReply, nightSignoffTip, setNudgeNightHour, isLateNight, DiaryWriter, DiaryAgent,
  reminderDue, reminderText, sniffAudioExt, md5Hex, pcmToWav, silkToWav, getSilkLib,
  // #15 路径层与共用文件模式
  renderPath, validatePathFormat, normalizeHeading, escapeRegExp, locateSection, spliceSection, appendSection,
  normalizeNewlines, trimBody, escapeHeadingLines, escapeFenceLines, renderTemplate, isForeignFile, removeLastBlock, sealContent,
  firstOfDayPrefixShared, stripFirstPrefix, expiredNoticeShared, welcomeTextShared, helpText, UNDO_FOREIGN_REPLY,
  DEFAULT_SETTINGS,
  normalizeWebUrl, extractWebUrls, linkNoteFromText, isUnsafeWebUrl, extractArticleFromHtml,
  defaultWebClipFolder, isWechatArticleUrl, shouldClipWebUrl, escapeWebText, webClipIdentityUrl,
  safeClipFilename, formatWebClipMarkdown, requestWebClipBinaryDirect, webClipMaxImages, webClipMaxTotalImageBytes, WebClipper, WebClipError,
  texts2: { REMINDER_LINES, FILE_DUP_KEY_REPLY, FILE_TOO_BIG_REPLY, VOICE_FALLBACK_FAIL_REPLY,
    VIDEO_DUP_KEY_REPLY, VIDEO_TOO_BIG_REPLY, ATTACH_DISK_FULL_REPLY, REMINDER_TIME_RE },
};

module.exports = WechatDiaryPlugin;

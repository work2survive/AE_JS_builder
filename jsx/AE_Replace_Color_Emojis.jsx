/**
 * ============================================================================
 * AE Replace Color Emojis v1.0 — Procedural Color Emoji Replacement Engine
 * ============================================================================
 *
 * Repository: https://github.com/work2survive/AE-replace-color-emojis
 * Live Demo:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Replace_Color_Emojis.jsx&autobuild=true
 *
 * PURPOSE:
 *   Adobe After Effects text layers do not natively support color emoji fonts
 *   (COLR/CPAL, SBIX, CBDT/CBLC), rendering emojis pasted into text layers as
 *   monochrome black glyphs or missing-font boxes (□).
 *
 *   This script solves that by scanning text layers for emojis, calculating their
 *   exact geometric positions down to the sub-pixel using delimiter-anchored advance
 *   measurement (from AE-Text-Highlight), and replacing monochrome font glyphs with
 *   infinitely scalable, 100% native vector Shape Layer emojis (from AE_Get_Emojis).
 *
 * ARCHITECTURAL HIGHLIGHTS:
 *   1. Dual Replacement Engines:
 *      - Calculation Method (Intact Text Box - Recommended):
 *        Preserves original text layer completely intact and active.
 *        Applies a native After Effects Text Animator ("Hide Monochrome Emojis")
 *        with Opacity = 0% targeting the exact emoji character indices, cleanly hiding
 *        the monochrome font glyphs without altering text spacing or word wrap.
 *        Places full-color vector emoji shape layers directly in front.
 *      - Split Method (Layer Decomposition):
 *        Decomposes lines into independent text boxes for words with top-left anchors
 *        and places color emoji shape layers at each emoji's slot.
 *   2. Unicode Emoji Recognition Engine:
 *      - Scans Unicode surrogate pairs (U+1F000 - U+1FAFF: smileys, symbols, objects)
 *      - Scans BMP emojis (U+2600 - U+27BF, U+2B00 - U+2BFF: heart, sparkles, check, etc.)
 *      - Full support for Variation Selector-16 (\uFE0F) and multi-char glyphs
 *      - Optional: Detects and replaces text emoticons (:D, :), <3, etc.) and
 *        shortcodes (:fire:, :thumbsup:, :rocket:) from the Wikipedia Emoticons catalog!
 *   3. 4 Full-Color Vector Styles (from OpenMoji & Twemoji):
 *      - OpenMoji Color (full-color handcrafted shapes + outlines)
 *      - Twemoji Flat Color (modern flat shapes without black line-art)
 *      - OpenMoji Flat Color (color shapes without outlines)
 *      - OpenMoji Black (pure line-art / wireframe)
 *   4. Single Master Shape Layer vs. Separate Layer per Emoji:
 *      - Single Master Shape Layer groups all emojis into a clean, unified timeline layer
 *      - Separate Shape Layer per Emoji gives individual layer animation controls
 *   5. Mandatory First-Action Anchor Alignment with 0.00px Visual Shift (AE-Align-AnchorPoint)
 *   6. Master Expression Controls on Shape Layer:
 *      - Emoji Size (px) (rigged to fontSize * multiplier)
 *      - Emoji Size Multiplier %
 *      - Outline Width %
 *      - Show Outlines
 *      - Offset X, Offset Y
 *   7. Zero-Shift Precomposition Option (AE-text-precomp)
 *   8. Complete Clean Restore / Undo System
 * ============================================================================
 */

(function (thisObj) {
    "use strict";

    var SCRIPT_TITLE = "AE Replace Color Emojis";
    var SCRIPT_VERSION = "v1.0";
    var GITHUB_REPO_URL = "https://github.com/work2survive/AE-replace-color-emojis";

    var globalObj = (typeof window !== "undefined")
        ? window
        : ((typeof $ !== "undefined" && typeof $.global !== "undefined")
            ? $.global
            : ((typeof global !== "undefined") ? global : (thisObj || {})));

    if (typeof globalObj.$ === "undefined") {
        globalObj.$ = {
            global: globalObj,
            writeln: function (msg) {
                if (typeof console !== "undefined" && console.log) console.log(msg);
            }
        };
    }

    // =========================================================================
    // 1. ES3 / EXTENDSCRIPT POLYFILLS & STRING HELPERS
    // =========================================================================
    var JSONPolyfill = (typeof JSON !== "undefined" && JSON.parse && JSON.stringify) ? JSON : {
        parse: function (str) {
            return eval("(" + str + ")");
        },
        stringify: function (obj) {
            if (obj === null || typeof obj === "undefined") return "null";
            if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
            if (typeof obj === "string") {
                return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
            }
            if (obj instanceof Array) {
                var arr = [];
                for (var i = 0; i < obj.length; i++) arr.push(JSONPolyfill.stringify(obj[i]));
                return "[" + arr.join(",") + "]";
            }
            if (typeof obj === "object") {
                var pairs = [];
                for (var k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        pairs.push(JSONPolyfill.stringify(k) + ":" + JSONPolyfill.stringify(obj[k]));
                    }
                }
                return "{" + pairs.join(",") + "}";
            }
            return '""';
        }
    };

    function trimStr(str) {
        if (!str) return "";
        return String(str).replace(/^\s+|\s+$/g, "");
    }

    function unicodeHexToInt(hex) {
        if (!hex) return 0;
        var cleanHex = String(hex).replace(/^(0x|U\+|\#)/i, "");
        var parts = cleanHex.split("-");
        var baseHex = parts[0];
        var val = parseInt(baseHex, 16);
        return isNaN(val) ? 0 : val;
    }

    function codePointToGlyph(cp) {
        if (!cp || cp <= 0) return "";
        if (cp <= 0xFFFF) {
            return String.fromCharCode(cp);
        }
        var offset = cp - 0x10000;
        var high = 0xD800 + (offset >> 10);
        var low = 0xDC00 + (offset & 0x3FF);
        return String.fromCharCode(high, low);
    }

    function isBrowserSim() {
        return (typeof window !== "undefined" && typeof document !== "undefined");
    }

    // =========================================================================
    // 2. EMBEDDED STANDALONE FALLBACK DATASETS
    // =========================================================================
    var FALLBACK_INDEX_DATA = {"version":"1.0.0","totalCount":48,"emojis":[{"index":1,"hexcode":"1F642","unicode":"U+1F642","unicodeInt":128578,"emoji":"🙂","name":"slightly smiling face","group":"smileys-emotion","subgroups":"face-smiling","tags":["face","happy","slightly","smile","smiling","satisfied"],"emoticons":[":-)",":)",":-]",":]",":->",":>","8-)","8)",":-}",":}",":o)",":c)",":^)","=]","=)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":2,"hexcode":"1F603","unicode":"U+1F603","unicodeInt":128515,"emoji":"😃","name":"grinning face with big eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["awesome","big","eyes","face","grin","grinning","happy","mouth","open","smile","smiling","teeth","yay"],"emoticons":[":-D",":D","8-D","8D","=D","=3","B^D","c:","C:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":3,"hexcode":"1F606","unicode":"U+1F606","unicodeInt":128518,"emoji":"😆","name":"grinning squinting face","group":"smileys-emotion","subgroups":"face-smiling","tags":["closed","eyes","face","grinning","haha","hahaha","happy","laugh","lol","mouth","open","rofl","smile","smiling","squinting"],"emoticons":["x-D","xD","X-D","XD"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":4,"hexcode":"1F604","unicode":"U+1F604","unicodeInt":128516,"emoji":"😄","name":"grinning face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["eye","eyes","face","grin","grinning","happy","laugh","lol","mouth","open","smile","smiling","teeth"],"emoticons":[":-))",":))"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":5,"hexcode":"1F601","unicode":"U+1F601","unicodeInt":128513,"emoji":"😁","name":"beaming face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["beaming","eye","eyes","face","grin","grinning","happy","nice","smile","smiling","teeth","mouth"],"emoticons":["^_^","^-^","^.^","(^_^)","(^-^)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":6,"hexcode":"1F602","unicode":"U+1F602","unicodeInt":128514,"emoji":"😂","name":"face with tears of joy","group":"smileys-emotion","subgroups":"face-smiling","tags":["crying","face","feels","funny","haha","happy","hehe","hilarious","joy","laugh","lmao","lol","rofl","roflmao","tear"],"emoticons":[":'-)",":')",":'D",":'-D",":\"D"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":7,"hexcode":"1F923","unicode":"U+1F923","unicodeInt":129315,"emoji":"🤣","name":"rolling on the floor laughing","group":"smileys-emotion","subgroups":"face-smiling","tags":["crying","face","floor","funny","haha","happy","hehe","hilarious","joy","laugh","lmao","lol","rofl","roflmao","rolling","tear","tears"],"emoticons":["ROFL","LMAO","XD!"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":8,"hexcode":"1F60A","unicode":"U+1F60A","unicodeInt":128522,"emoji":"😊","name":"smiling face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["blush","eye","eyes","face","glad","satisfied","smile","smiling"],"emoticons":["(◕‿◕)","(｡◕‿◕｡)","^^","^o^"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":9,"hexcode":"1F607","unicode":"U+1F607","unicodeInt":128519,"emoji":"😇","name":"smiling face with halo","group":"smileys-emotion","subgroups":"face-smiling","tags":["angel","angelic","angels","blessed","face","fairy","fairytale","fantasy","halo","happy","innocent","peaceful","smile","smiling","spirit","tale"],"emoticons":["O:-)","O:)","0:-3","0:3","0:-)","0:)","0;^)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":10,"hexcode":"1F608","unicode":"U+1F608","unicodeInt":128520,"emoji":"😈","name":"smiling face with horns","group":"smileys-emotion","subgroups":"face-negative","tags":["demon","devil","evil","face","fairy","fairytale","fantasy","horns","purple","shade","smile","smiling","tale","malicious","sardonic"],"emoticons":[">:-)",">:)","}:-)","}:)","3:-)","3:)",">;-)",">;)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":11,"hexcode":"1F609","unicode":"U+1F609","unicodeInt":128521,"emoji":"😉","name":"winking face","group":"smileys-emotion","subgroups":"face-smiling","tags":["face","flirt","heartbreaker","sexy","slide","tease","wink","winking","winks","eye"],"emoticons":[";-)",";)","*-)","*)",";-]",";]",";^)",";>",":-,",";D",";3"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":12,"hexcode":"1F60D","unicode":"U+1F60D","unicodeInt":128525,"emoji":"😍","name":"smiling face with heart-eyes","group":"smileys-emotion","subgroups":"face-affection","tags":["143","bae","eye","face","feels","heart-eyes","hearts","ily","kisses","love","romance","romantic","smile","xoxo","happy"],"emoticons":["(♥_♥)","♥_♥","<3_<3","*❤️*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":13,"hexcode":"1F60E","unicode":"U+1F60E","unicodeInt":128526,"emoji":"😎","name":"smiling face with sunglasses","group":"smileys-emotion","subgroups":"face-glasses","tags":["awesome","beach","bright","bro","chilling","cool","face","rad","relaxed","shades","slay","smile","style","sunglasses","swag","win"],"emoticons":["B-)","B)","|;-)","8-)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":14,"hexcode":"1F60F","unicode":"U+1F60F","unicodeInt":128527,"emoji":"😏","name":"smirking face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["boss","dapper","face","flirt","homie","kidding","leer","shade","slick","sly","smirk","smug","snicker","suave","suspicious","swag"],"emoticons":[":-J","( ͡° ͜ʖ ͡°)",";->"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":15,"hexcode":"1F610","unicode":"U+1F610","unicodeInt":128528,"emoji":"😐️","name":"neutral face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["awkward","blank","deadpan","expressionless","face","fine","jealous","meh","neutral","oh","shade","straight","unamused","unhappy","unimpressed","whatever","poker face"],"emoticons":[":-|",":|","._.","-_-"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":16,"hexcode":"1F612","unicode":"U+1F612","unicodeInt":128530,"emoji":"😒","name":"unamused face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["...","bored","face","fine","jealous","jel","jelly","pissed","smh","ugh","uhh","unamused","unhappy","weird","whatever"],"emoticons":["ಠ_ಠ",">_>","<_<","¬_¬"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":17,"hexcode":"1F615","unicode":"U+1F615","unicodeInt":128533,"emoji":"😕","name":"confused face","group":"smileys-emotion","subgroups":"face-concerned","tags":["befuddled","confused","confusing","dunno","face","frown","hm","meh","not","sad","sorry","sure"],"emoticons":[":-/",":/",":-.",">:\\",">:/",":\\","=/","=\\",":L","=L"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":18,"hexcode":"1F618","unicode":"U+1F618","unicodeInt":128536,"emoji":"😘","name":"face blowing a kiss","group":"smileys-emotion","subgroups":"face-affection","tags":["adorbs","bae","blowing","face","flirt","heart","ily","kiss","love","lover","miss","muah","romantic","smooch","xoxo","you","happy"],"emoticons":[":-*",":*",":x","^3^","( ˘ ³˘)♥"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":19,"hexcode":"1F61B","unicode":"U+1F61B","unicodeInt":128539,"emoji":"😛","name":"face with tongue","group":"smileys-emotion","subgroups":"face-tongue","tags":["awesome","cool","face","nice","party","stuck-out","sweet","tongue"],"emoticons":[":-P",":P",":-p",":p",":-Þ",":Þ",":-þ",":þ",":-b",":b","d:","=p",">:P"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":20,"hexcode":"1F61C","unicode":"U+1F61C","unicodeInt":128540,"emoji":"😜","name":"winking face with tongue","group":"smileys-emotion","subgroups":"face-tongue","tags":["crazy","epic","eye","face","funny","joke","loopy","nutty","party","stuck-out","tongue","wacky","weirdo","wink","winking","yolo"],"emoticons":[";P",";-P",";p",";-p"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":21,"hexcode":"1F620","unicode":"U+1F620","unicodeInt":128544,"emoji":"😠","name":"angry face","group":"smileys-emotion","subgroups":"face-negative","tags":["anger","angry","blame","face","feels","frustrated","mad","maddening","rage","shade","unhappy","upset"],"emoticons":[">:(",">:-(",":@"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":22,"hexcode":"1F621","unicode":"U+1F621","unicodeInt":128545,"emoji":"😡","name":"enraged face","group":"smileys-emotion","subgroups":"face-negative","tags":["anger","angry","enraged","face","feels","mad","maddening","pouting","rage","red","shade","unhappy","upset"],"emoticons":["D:<","(╯°□°）╯︵ ┻━┻","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":23,"hexcode":"1F622","unicode":"U+1F622","unicodeInt":128546,"emoji":"😢","name":"crying face","group":"smileys-emotion","subgroups":"face-concerned","tags":["awful","cry","crying","face","feels","miss","sad","tear","triste","unhappy"],"emoticons":[":'-(",":'(",":=(",";("],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":24,"hexcode":"1F62D","unicode":"U+1F62D","unicodeInt":128557,"emoji":"😭","name":"loudly crying face","group":"smileys-emotion","subgroups":"face-concerned","tags":["bawling","cry","crying","face","loudly","sad","sob","tear","tears","unhappy"],"emoticons":["T_T","ToT","T-T",";_;","Q_Q","QQ","😭"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":25,"hexcode":"1F62E","unicode":"U+1F62E","unicodeInt":128558,"emoji":"😮","name":"face with open mouth","group":"smileys-emotion","subgroups":"face-concerned","tags":["believe","face","forgot","mouth","omg","open","shocked","surprised","sympathy","unbelievable","unreal","whoa","wow","you"],"emoticons":[":-O",":O",":-o",":o",":-0",":0","8-0",">:O","=O","=o","=0","O_O","o_o"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":26,"hexcode":"1F633","unicode":"U+1F633","unicodeInt":128563,"emoji":"😳","name":"flushed face","group":"smileys-emotion","subgroups":"face-concerned","tags":["amazed","awkward","crazy","dazed","dead","disbelief","embarrassed","face","flushed","geez","heat","hot","impressed","jeez","what","wow","red jaws"],"emoticons":[":$",":-$","😳"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":27,"hexcode":"1F634","unicode":"U+1F634","unicodeInt":128564,"emoji":"😴","name":"sleeping face","group":"smileys-emotion","subgroups":"face-sleepy","tags":["bed","bedtime","face","good","goodnight","nap","night","sleep","sleeping","tired","whatever","yawn","zzz"],"emoticons":["|-O","z_z","Z_Z","(-_-)zzz"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":28,"hexcode":"1F635","unicode":"U+1F635","unicodeInt":128565,"emoji":"😵","name":"face with crossed-out eyes","group":"smileys-emotion","subgroups":"face-unwell","tags":["crossed-out","dead","dizzy","eyes","face","feels","knocked","out","sick","tired","dead eyes"],"emoticons":["%-)","%)","#-)","x_x","X_X","+_+"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":29,"hexcode":"1F641","unicode":"U+1F641","unicodeInt":128577,"emoji":"🙁","name":"slightly frowning face","group":"smileys-emotion","subgroups":"face-concerned","tags":["face","frown","frowning","sad","slightly"],"emoticons":[":-(",":(",":-c",":c",":-<",":<",":-[",":[",":-||",":{"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":30,"hexcode":"1F63A","unicode":"U+1F63A","unicodeInt":128570,"emoji":"😺","name":"grinning cat","group":"smileys-emotion","subgroups":"cat-face","tags":["animal","cat","face","grinning","mouth","open","smile","smiling"],"emoticons":[":-3",":3","=3","x3","X3",">:3","uwu","UwU","owo","OwO"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":31,"hexcode":"1F929","unicode":"U+1F929","unicodeInt":129321,"emoji":"🤩","name":"star-struck","group":"smileys-emotion","subgroups":"face-affection","tags":["excited","eyes","face","grinning","smile","star","starry-eyed","wow","surprised"],"emoticons":["*_*","*o*","☆_☆"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":32,"hexcode":"1F914","unicode":"U+1F914","unicodeInt":129300,"emoji":"🤔","name":"thinking face","group":"smileys-emotion","subgroups":"face-hand","tags":["chin","consider","face","hmm","ponder","pondering","thinking","wondering","hand","overthinking","frown","curious"],"emoticons":[":thinking:",":?",":-?"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":33,"hexcode":"1F937","unicode":"U+1F937","unicodeInt":129335,"emoji":"🤷","name":"person shrugging","group":"people-body","subgroups":"person-gesture","tags":["doubt","dunno","guess","idk","ignorance","indifference","knows","maybe","person","shrug","shrugging","whatever","who","human","head","face"],"emoticons":["¯\\_(ツ)_/¯","¯\\(°_o)/¯"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":34,"hexcode":"1F64C","unicode":"U+1F64C","unicodeInt":128588,"emoji":"🙌","name":"raising hands","group":"people-body","subgroups":"hands","tags":["celebration","gesture","hand","hands","hooray","praise","raised","raising","raising hands","arms in the air","banzai","Festivus miracle","hallelujah","praise hands","two hands"],"emoticons":["\\o/","*\\0/*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":35,"hexcode":"1FAE1","unicode":"U+1FAE1","unicodeInt":129761,"emoji":"🫡","name":"saluting face","group":"smileys-emotion","subgroups":"face-hand","tags":["face","good","luck","ma’am","ok","respect","salute","saluting","sir","troops","yes"],"emoticons":["o7","<o/"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":36,"hexcode":"2764","unicode":"U+2764","unicodeInt":10084,"emoji":"❤️","name":"red heart","group":"smileys-emotion","subgroups":"heart","tags":["emotion","heart","love","red"],"emoticons":["<3","<33",":heart:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":37,"hexcode":"1F494","unicode":"U+1F494","unicodeInt":128148,"emoji":"💔","name":"broken heart","group":"smileys-emotion","subgroups":"heart","tags":["break","broken","crushed","emotion","heart","heartbroken","lonely","sad","heartbreak"],"emoticons":["</3","<\\3"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":38,"hexcode":"1F44D","unicode":"U+1F44D","unicodeInt":128077,"emoji":"👍️","name":"thumbs up","group":"people-body","subgroups":"hand-fingers-closed","tags":["+1","good","hand","like","thumb","up","yes","thumbs up"],"emoticons":["(y)","(Y)",":+1:",":thumbsup:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":39,"hexcode":"1F44E","unicode":"U+1F44E","unicodeInt":128078,"emoji":"👎️","name":"thumbs down","group":"people-body","subgroups":"hand-fingers-closed","tags":["-1","bad","dislike","down","good","hand","no","nope","thumb","thumbs","thumbs down","thumbs down sign"],"emoticons":["(n)","(N)",":-1:",":thumbsdown:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":40,"hexcode":"1F480","unicode":"U+1F480","unicodeInt":128128,"emoji":"💀","name":"skull","group":"smileys-emotion","subgroups":"face-negative","tags":["body","dead","death","face","fairy","fairytale","i’m","lmao","monster","tale","yolo","skull"],"emoticons":["8-X","8=X",":skull:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":41,"hexcode":"1F525","unicode":"U+1F525","unicodeInt":128293,"emoji":"🔥","name":"fire","group":"travel-places","subgroups":"sky-weather","tags":["af","burn","flame","hot","lit","litaf","tool","fire","high temperature","glow"],"emoticons":[":fire:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":42,"hexcode":"1F4AF","unicode":"U+1F4AF","unicodeInt":128175,"emoji":"💯","name":"hundred points","group":"smileys-emotion","subgroups":"emotion","tags":["100","a+","agree","clearly","definitely","faithful","fleek","full","hundred","keep","perfect","point","score","true","truth","yup","excellent"],"emoticons":[":100:","100%"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":43,"hexcode":"1F4A9","unicode":"U+1F4A9","unicodeInt":128169,"emoji":"💩","name":"pile of poo","group":"smileys-emotion","subgroups":"face-costume","tags":["bs","comic","doo","dung","face","fml","monster","pile","poo","poop","smelly","smh","stink","stinks","stinky","turd"],"emoticons":[":poop:",":hankey:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":44,"hexcode":"2728","unicode":"U+2728","unicodeInt":10024,"emoji":"✨️","name":"sparkles","group":"activities","subgroups":"event","tags":["*","magic","sparkle","star","beautiful"],"emoticons":[":sparkles:","*+*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":45,"hexcode":"1F680","unicode":"U+1F680","unicodeInt":128640,"emoji":"🚀","name":"rocket","group":"travel-places","subgroups":"transport-air","tags":["launch","rockets","space","travel","rocket","galaxy","adventure","alien","transportation"],"emoticons":[":rocket:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":46,"hexcode":"2705","unicode":"U+2705","unicodeInt":9989,"emoji":"✅️","name":"check mark button","group":"symbols","subgroups":"other-symbol","tags":["button","check","checked","checkmark","complete","completed","done","fixed","mark","tick","✓","white","right","todo"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":47,"hexcode":"26A0","unicode":"U+26A0","unicodeInt":9888,"emoji":"⚠️","name":"warning","group":"symbols","subgroups":"warning","tags":["caution"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":48,"hexcode":"1F389","unicode":"U+1F389","unicodeInt":127881,"emoji":"🎉","name":"party popper","group":"activities","subgroups":"event","tags":["awesome","birthday","celebrate","celebration","excited","hooray","party","popper","tada","woohoo","decoration","happy"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]}]};
    var FALLBACK_WIKI_DATA = {"source":"https://en.wikipedia.org/wiki/List_of_emoticons","description":"Mapping of Western sideways and Eastern kaomoji text emoticons to Unicode hexcode and integer codepoints.","lookup":{":-)":"1F642",":)":"1F642",":-]":"1F642",":]":"1F642",":->":"1F642",":>":"1F642","8-)":"1F60E","8)":"1F642",":-}":"1F642",":}":"1F642",":o)":"1F642",":c)":"1F642",":^)":"1F642","=]":"1F642","=)":"1F642",":-D":"1F603",":-d":"1F603",":D":"1F603",":d":"1F603","8-D":"1F603","8-d":"1F603","8D":"1F603","8d":"1F603","=D":"1F603","=d":"1F603","=3":"1F63A","B^D":"1F603","b^d":"1F603","c:":"1F603","C:":"1F603","x-D":"1F606","x-d":"1F606","xD":"1F606","xd":"1F606","X-D":"1F606","XD":"1F606",":-))":"1F604",":))":"1F604","^_^":"1F601","^-^":"1F601","^.^":"1F601","(^_^)":"1F601","(^-^)":"1F601",":'-)":"1F602",":')":"1F602",":'D":"1F602",":'d":"1F602",":'-D":"1F602",":'-d":"1F602",":\"D":"1F602",":\"d":"1F602","ROFL":"1F923","rofl":"1F923","LMAO":"1F923","lmao":"1F923","XD!":"1F923","xd!":"1F923","(◕‿◕)":"1F60A","(｡◕‿◕｡)":"1F60A","^^":"1F60A","^o^":"1F60A","O:-)":"1F607","o:-)":"1F607","O:)":"1F607","o:)":"1F607","0:-3":"1F607","0:3":"1F607","0:-)":"1F607","0:)":"1F607","0;^)":"1F607",">:-)":"1F608",">:)":"1F608","}:-)":"1F608","}:)":"1F608","3:-)":"1F608","3:)":"1F608",">;-)":"1F608",">;)":"1F608",";-)":"1F609",";)":"1F609","*-)":"1F609","*)":"1F609",";-]":"1F609",";]":"1F609",";^)":"1F609",";>":"1F609",":-,":"1F609",";D":"1F609",";d":"1F609",";3":"1F609",":-9":"1F60B",":9":"1F60B","(♥_♥)":"1F60D","♥_♥":"1F60D","<3_<3":"1F60D","*❤️*":"1F60D","B-)":"1F60E","b-)":"1F60E","B)":"1F60E","b)":"1F60E","|;-)":"1F60E",":-J":"1F60F",":-j":"1F60F","( ͡° ͜ʖ ͡°)":"1F60F",";->":"1F60F",":-|":"1F610",":|":"1F610","._.":"1F610","-_-":"1F610","=_=":"1F611","-_-;":"1F611","u_u":"1F611","~_~":"1F611","ಠ_ಠ":"1F612",">_>":"1F612","<_<":"1F612","¬_¬":"1F612",":-/":"1F615",":/":"1F615",":-.":"1F615",">:\\":"1F615",">:/":"1F615",":\\":"1F615","=/":"1F615","=\\":"1F615",":L":"1F615",":l":"1F615","=L":"1F615","=l":"1F615",":S":"1F616",":s":"1F616",":-S":"1F616",":-s":"1F616",">_<":"1F616",">.<":"1F616",":-*":"1F618",":*":"1F618",":x":"1F636","^3^":"1F618","( ˘ ³˘)♥":"1F618",":-P":"1F61B",":-p":"1F61B",":P":"1F61B",":p":"1F61B",":-Þ":"1F61B",":-þ":"1F61B",":Þ":"1F61B",":þ":"1F61B",":-b":"1F61B",":b":"1F61B","d:":"1F626","=p":"1F61B",">:P":"1F61B",">:p":"1F61B",";P":"1F61C",";p":"1F61C",";-P":"1F61C",";-p":"1F61C","X-P":"1F61D","x-p":"1F61D","XP":"1F61D","xp":"1F61D","v.v":"1F61E","v_v":"1F61E","._.;":"1F61E",">:(":"1F620",">:-(":"1F620",":@":"1F620","D:<":"1F621","d:<":"1F621","(╯°□°）╯︵ ┻━┻":"1F621","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻":"1F621","┻━┻ ︵ヽ(`д´)ﾉ︵ ┻━┻":"1F621",":'-(":"1F622",":'(":"1F622",":=(":"1F622",";(":"1F622","T_T":"1F62D","t_t":"1F62D","ToT":"1F62D","tot":"1F62D","T-T":"1F62D","t-t":"1F62D",";_;":"1F62D","Q_Q":"1F62D","q_q":"1F62D","QQ":"1F62D","qq":"1F62D","😭":"1F62D","D:":"1F626","D=":"1F626","d=":"1F626","D;":"1F626","d;":"1F626","D-':":"1F628","d-':":"1F628","D8":"1F628","d8":"1F628","DX":"1F628","dx":"1F628",":-O":"1F62E",":-o":"1F62E",":O":"1F62E",":o":"1F62E",":-0":"1F62E",":0":"1F62E","8-0":"1F62E",">:O":"1F62E",">:o":"1F62E","=O":"1F62E","=o":"1F62E","=0":"1F62E","O_O":"1F62E","o_o":"1F632","0_0":"1F632","O.O":"1F632","o.o":"1F632","o_O":"1F632","O_o":"1F632",":$":"1F633",":-$":"1F633","😳":"1F633","|-O":"1F634","|-o":"1F634","z_z":"1F634","Z_Z":"1F634","(-_-)zzz":"1F634","%-)":"1F635","%)":"1F635","#-)":"1F635","x_x":"1F635","X_X":"1F635","+_+":"1F635",":-X":"1F636",":-x":"1F636",":X":"1F636",":-#":"1F636",":#":"1F636",":-&":"1F636",":&":"1F636",":-Z":"1F910",":-z":"1F910",":Z":"1F910",":z":"1F910",":-(":"1F641",":(":"1F641",":-c":"1F641",":c":"1F641",":-<":"1F641",":<":"1F641",":-[":"1F641",":[":"1F641",":-||":"1F641",":{":"1F641",":-3":"1F63A",":3":"1F63A","x3":"1F63A","X3":"1F63A",">:3":"1F63A","uwu":"1F63A","UwU":"1F63A","owo":"1F63A","OwO":"1F63A","$_$":"1F911","($.$)":"1F911","*_*":"1F929","*o*":"1F929","☆_☆":"1F929","',:-I":"1F928","',:-i":"1F928","',:-l":"1F928","🤨":"1F928",":thinking:":"1F914",":?":"1F914",":-?":"1F914","(づ｡◕‿‿◕｡)づ":"1F917","༼ つ ◕_◕ ༽つ":"1F917","¯\\_(ツ)_/¯":"1F937","¯\\(°_o)/¯":"1F937","\\o/":"1F64C","*\\0/*":"1F64C","o7":"1FAE1","<o/":"1FAE1","<3":"2764","<33":"2764",":heart:":"2764","</3":"1F494","<\\3":"1F494","@};-":"1F339","@}->--":"1F339","@}-;-'---":"1F339","@>-->--":"1F339","\\m/":"1F918","\\,,/":"1F918","(y)":"1F44D","(Y)":"1F44D",":+1:":"1F44D",":thumbsup:":"1F44D","(n)":"1F44E","(N)":"1F44E",":-1:":"1F44E",":thumbsdown:":"1F44E","><>":"1F41F","<><":"1F41F","<*)))>-{":"1F41F","*<|:-)":"1F385","c[_]":"2615","c\\_/":"2615","ʕ•ᴥ•ʔ":"1F43B","⊂(￣(ｴ)￣)⊃":"1F43B","8-X":"1F480","8-x":"1F480","8=X":"1F480","8=x":"1F480",":skull:":"1F480",":fire:":"1F525",":100:":"1F4AF","100%":"1F4AF",":poop:":"1F4A9",":hankey:":"1F4A9",":sparkles:":"2728","*+*":"2728",":rocket:":"1F680"},"entries":[{"hexcode":"1F642","unicode":"U+1F642","unicodeInt":128578,"emoji":"🙂","meaning":"Smiley, happy face","section":"Western (Sideways)","emoticons":[":-)",":)",":-]",":]",":->",":>","8-)","8)",":-}",":}",":o)",":c)",":^)","=]","=)"]},{"hexcode":"1F603","unicode":"U+1F603","unicodeInt":128515,"emoji":"😃","meaning":"Laughing, big grin, grinning with big eyes","section":"Western (Sideways)","emoticons":[":-D",":D","8-D","8D","=D","=3","B^D","c:","C:"]},{"hexcode":"1F606","unicode":"U+1F606","unicodeInt":128518,"emoji":"😆","meaning":"Laughing, big grin with squinting eyes","section":"Western (Sideways)","emoticons":["x-D","xD","X-D","XD"]},{"hexcode":"1F604","unicode":"U+1F604","unicodeInt":128516,"emoji":"😄","meaning":"Very happy, double chin grin","section":"Western (Sideways)","emoticons":[":-))",":))"]},{"hexcode":"1F601","unicode":"U+1F601","unicodeInt":128513,"emoji":"😁","meaning":"Beaming face with smiling eyes","section":"Eastern / Kaomoji","emoticons":["^_^","^-^","^.^","(^_^)","(^-^)"]},{"hexcode":"1F602","unicode":"U+1F602","unicodeInt":128514,"emoji":"😂","meaning":"Face with tears of joy","section":"Western (Sideways)","emoticons":[":'-)",":')",":'D",":'-D",":\"D"]},{"hexcode":"1F923","unicode":"U+1F923","unicodeInt":129315,"emoji":"🤣","meaning":"Rolling on the floor laughing (ROFL)","section":"Western (Sideways)","emoticons":["ROFL","LMAO","XD!"]},{"hexcode":"1F60A","unicode":"U+1F60A","unicodeInt":128522,"emoji":"😊","meaning":"Smiling face with smiling eyes / blush","section":"Eastern / Kaomoji","emoticons":["(◕‿◕)","(｡◕‿◕｡)","^^","^o^"]},{"hexcode":"1F607","unicode":"U+1F607","unicodeInt":128519,"emoji":"😇","meaning":"Angel, saint, innocent halo","section":"Western (Sideways)","emoticons":["O:-)","O:)","0:-3","0:3","0:-)","0:)","0;^)"]},{"hexcode":"1F608","unicode":"U+1F608","unicodeInt":128520,"emoji":"😈","meaning":"Evil, devilish grin with horns","section":"Western (Sideways)","emoticons":[">:-)",">:)","}:-)","}:)","3:-)","3:)",">;-)",">;)"]},{"hexcode":"1F609","unicode":"U+1F609","unicodeInt":128521,"emoji":"😉","meaning":"Wink, smirk","section":"Western (Sideways)","emoticons":[";-)",";)","*-)","*)",";-]",";]",";^)",";>",":-,",";D",";3"]},{"hexcode":"1F60B","unicode":"U+1F60B","unicodeInt":128523,"emoji":"😋","meaning":"Face savoring food, yummy","section":"Western (Sideways)","emoticons":[":-9",":9"]},{"hexcode":"1F60D","unicode":"U+1F60D","unicodeInt":128525,"emoji":"😍","meaning":"Smiling face with heart-eyes, infatuation","section":"Eastern / Kaomoji","emoticons":["(♥_♥)","♥_♥","<3_<3","*❤️*"]},{"hexcode":"1F60E","unicode":"U+1F60E","unicodeInt":128526,"emoji":"😎","meaning":"Cool, sunglasses, shades","section":"Western (Sideways)","emoticons":["B-)","B)","|;-)","8-)"]},{"hexcode":"1F60F","unicode":"U+1F60F","unicodeInt":128527,"emoji":"😏","meaning":"Smirking, sly, Lenny face","section":"Western / Kaomoji","emoticons":[":-J","( ͡° ͜ʖ ͡°)",";->"]},{"hexcode":"1F610","unicode":"U+1F610","unicodeInt":128528,"emoji":"😐","meaning":"Straight face, no expression, indecision","section":"Western (Sideways)","emoticons":[":-|",":|","._.","-_-"]},{"hexcode":"1F611","unicode":"U+1F611","unicodeInt":128529,"emoji":"😑","meaning":"Expressionless, tired, unimpressed","section":"Eastern / Kaomoji","emoticons":["=_=","-_-;","u_u","~_~"]},{"hexcode":"1F612","unicode":"U+1F612","unicodeInt":128530,"emoji":"😒","meaning":"Unamused, skeptical, side-eye, look of disapproval","section":"Eastern / Kaomoji","emoticons":["ಠ_ಠ",">_>","<_<","¬_¬"]},{"hexcode":"1F615","unicode":"U+1F615","unicodeInt":128533,"emoji":"😕","meaning":"Skeptical, annoyed, undecided, uneasy, hesitant","section":"Western (Sideways)","emoticons":[":-/",":/",":-.",">:\\",">:/",":\\","=/","=\\",":L","=L"]},{"hexcode":"1F616","unicode":"U+1F616","unicodeInt":128534,"emoji":"😖","meaning":"Confounded, scrunched face, cringed","section":"Western / Kaomoji","emoticons":[":S",":-S",">_<",">.<"]},{"hexcode":"1F618","unicode":"U+1F618","unicodeInt":128536,"emoji":"😘","meaning":"Face blowing a kiss","section":"Western (Sideways)","emoticons":[":-*",":*",":x","^3^","( ˘ ³˘)♥"]},{"hexcode":"1F61B","unicode":"U+1F61B","unicodeInt":128539,"emoji":"😛","meaning":"Tongue sticking out, cheeky, playful","section":"Western (Sideways)","emoticons":[":-P",":P",":-p",":p",":-Þ",":Þ",":-þ",":þ",":-b",":b","d:","=p",">:P"]},{"hexcode":"1F61C","unicode":"U+1F61C","unicodeInt":128540,"emoji":"😜","meaning":"Winking face with tongue","section":"Western (Sideways)","emoticons":[";P",";-P",";p",";-p"]},{"hexcode":"1F61D","unicode":"U+1F61D","unicodeInt":128541,"emoji":"😝","meaning":"Squinting face with tongue, playful","section":"Western (Sideways)","emoticons":["X-P","XP","x-p","xp"]},{"hexcode":"1F61E","unicode":"U+1F61E","unicodeInt":128542,"emoji":"😞","meaning":"Disappointed, sad, dejected","section":"Eastern / Kaomoji","emoticons":["v.v","v_v","._.;"]},{"hexcode":"1F620","unicode":"U+1F620","unicodeInt":128544,"emoji":"😠","meaning":"Angry face","section":"Western (Sideways)","emoticons":[">:(",">:-(",":@"]},{"hexcode":"1F621","unicode":"U+1F621","unicodeInt":128545,"emoji":"😡","meaning":"Pouting, very angry, rage, table flip","section":"Western / Kaomoji","emoticons":["D:<","(╯°□°）╯︵ ┻━┻","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻"]},{"hexcode":"1F622","unicode":"U+1F622","unicodeInt":128546,"emoji":"😢","meaning":"Crying face, single tear","section":"Western (Sideways)","emoticons":[":'-(",":'(",":=(",";("]},{"hexcode":"1F62D","unicode":"U+1F62D","unicodeInt":128557,"emoji":"😭","meaning":"Loudly crying face, bawling","section":"Eastern / Kaomoji","emoticons":["T_T","ToT","T-T",";_;","Q_Q","QQ","😭"]},{"hexcode":"1F626","unicode":"U+1F626","unicodeInt":128550,"emoji":"😦","meaning":"Frowning with open mouth, dismay","section":"Western (Sideways)","emoticons":["D:","D=","D;"]},{"hexcode":"1F628","unicode":"U+1F628","unicodeInt":128552,"emoji":"😨","meaning":"Fearful, horror, shock","section":"Western (Sideways)","emoticons":["D-':","D8","DX"]},{"hexcode":"1F62E","unicode":"U+1F62E","unicodeInt":128558,"emoji":"😮","meaning":"Surprise, shock, open mouth","section":"Western (Sideways)","emoticons":[":-O",":O",":-o",":o",":-0",":0","8-0",">:O","=O","=o","=0","O_O","o_o"]},{"hexcode":"1F632","unicode":"U+1F632","unicodeInt":128562,"emoji":"😲","meaning":"Astonished, gasping in shock","section":"Eastern / Kaomoji","emoticons":["0_0","O.O","o_O","O_o"]},{"hexcode":"1F633","unicode":"U+1F633","unicodeInt":128563,"emoji":"😳","meaning":"Flushed, embarrassed, blushing","section":"Western (Sideways)","emoticons":[":$",":-$","😳"]},{"hexcode":"1F634","unicode":"U+1F634","unicodeInt":128564,"emoji":"😴","meaning":"Sleeping, bored, yawn","section":"Western / Kaomoji","emoticons":["|-O","z_z","Z_Z","(-_-)zzz"]},{"hexcode":"1F635","unicode":"U+1F635","unicodeInt":128565,"emoji":"😵","meaning":"Dizzy, knocked out, dead eyes","section":"Western / Kaomoji","emoticons":["%-)","%)","#-)","x_x","X_X","+_+"]},{"hexcode":"1F636","unicode":"U+1F636","unicodeInt":128566,"emoji":"😶","meaning":"Face without mouth, speechless","section":"Western (Sideways)","emoticons":[":-X",":X",":-#",":#",":-&",":&"]},{"hexcode":"1F910","unicode":"U+1F910","unicodeInt":129296,"emoji":"🤐","meaning":"Zipper-mouth face, sealed lips","section":"Western (Sideways)","emoticons":[":-Z",":Z"]},{"hexcode":"1F641","unicode":"U+1F641","unicodeInt":128577,"emoji":"🙁","meaning":"Frowning, sad, pouting","section":"Western (Sideways)","emoticons":[":-(",":(",":-c",":c",":-<",":<",":-[",":[",":-||",":{"]},{"hexcode":"1F63A","unicode":"U+1F63A","unicodeInt":128570,"emoji":"😺","meaning":"Grinning cat, curly mouth / cat smile","section":"Western / Kaomoji","emoticons":[":-3",":3","=3","x3","X3",">:3","uwu","UwU","owo","OwO"]},{"hexcode":"1F911","unicode":"U+1F911","unicodeInt":129297,"emoji":"🤑","meaning":"Money-mouth face","section":"Eastern / Kaomoji","emoticons":["$_$","($.$)"]},{"hexcode":"1F929","unicode":"U+1F929","unicodeInt":129321,"emoji":"🤩","meaning":"Star-struck, amazed","section":"Eastern / Kaomoji","emoticons":["*_*","*o*","☆_☆"]},{"hexcode":"1F928","unicode":"U+1F928","unicodeInt":129320,"emoji":"🤨","meaning":"Face with raised eyebrow, skeptical","section":"Western (Sideways)","emoticons":["',:-I","',:-l","🤨"]},{"hexcode":"1F914","unicode":"U+1F914","unicodeInt":129300,"emoji":"🤔","meaning":"Thinking face, pondering","section":"Western (Sideways)","emoticons":[":thinking:",":?",":-?"]},{"hexcode":"1F917","unicode":"U+1F917","unicodeInt":129303,"emoji":"🤗","meaning":"Smiling face with open hands, hug","section":"Eastern / Kaomoji","emoticons":["(づ｡◕‿‿◕｡)づ","༼ つ ◕_◕ ༽つ"]},{"hexcode":"1F937","unicode":"U+1F937","unicodeInt":129335,"emoji":"🤷","meaning":"Person shrugging","section":"Eastern / Kaomoji","emoticons":["¯\\_(ツ)_/¯","¯\\(°_o)/¯"]},{"hexcode":"1F64C","unicode":"U+1F64C","unicodeInt":128588,"emoji":"🙌","meaning":"Raising hands, cheer, yay","section":"Western (Posture)","emoticons":["\\o/","*\\0/*"]},{"hexcode":"1FAE1","unicode":"U+1FAE1","unicodeInt":129761,"emoji":"🫡","meaning":"Saluting face / salute","section":"Western (Posture)","emoticons":["o7","<o/"]},{"hexcode":"2764","unicode":"U+2764","unicodeInt":10084,"emoji":"❤","meaning":"Red heart, love","section":"Western (Symbols)","emoticons":["<3","<33",":heart:"]},{"hexcode":"1F494","unicode":"U+1F494","unicodeInt":128148,"emoji":"💔","meaning":"Broken heart","section":"Western (Symbols)","emoticons":["</3","<\\3"]},{"hexcode":"1F339","unicode":"U+1F339","unicodeInt":127801,"emoji":"🌹","meaning":"Single rose","section":"Western (Symbols)","emoticons":["@};-","@}->--","@}-;-'---","@>-->--"]},{"hexcode":"1F918","unicode":"U+1F918","unicodeInt":129304,"emoji":"🤘","meaning":"Sign of the horns, rock on","section":"Western (Symbols)","emoticons":["\\m/","\\,,/"]},{"hexcode":"1F44D","unicode":"U+1F44D","unicodeInt":128077,"emoji":"👍","meaning":"Thumbs up, approve","section":"Western (Symbols)","emoticons":["(y)","(Y)",":+1:",":thumbsup:"]},{"hexcode":"1F44E","unicode":"U+1F44E","unicodeInt":128078,"emoji":"👎","meaning":"Thumbs down, disapprove","section":"Western (Symbols)","emoticons":["(n)","(N)",":-1:",":thumbsdown:"]},{"hexcode":"1F41F","unicode":"U+1F41F","unicodeInt":128031,"emoji":"🐟","meaning":"Fish","section":"Western (Symbols)","emoticons":["><>","<><","<*)))>-{"]},{"hexcode":"1F385","unicode":"U+1F385","unicodeInt":127877,"emoji":"🎅","meaning":"Santa Claus","section":"Western (Sideways)","emoticons":["*<|:-)"]},{"hexcode":"2615","unicode":"U+2615","unicodeInt":9749,"emoji":"☕","meaning":"Hot beverage, coffee mug","section":"Western (Symbols)","emoticons":["c[_]","c\\_/"]},{"hexcode":"1F43B","unicode":"U+1F43B","unicodeInt":128059,"emoji":"🐻","meaning":"Bear face","section":"Eastern / Kaomoji","emoticons":["ʕ•ᴥ•ʔ","⊂(￣(ｴ)￣)⊃"]},{"hexcode":"1F480","unicode":"U+1F480","unicodeInt":128128,"emoji":"💀","meaning":"Skull, dead","section":"Western (Sideways)","emoticons":["8-X","8=X",":skull:"]},{"hexcode":"1F525","unicode":"U+1F525","unicodeInt":128293,"emoji":"🔥","meaning":"Fire, lit","section":"Shortcodes","emoticons":[":fire:"]},{"hexcode":"1F4AF","unicode":"U+1F4AF","unicodeInt":128175,"emoji":"💯","meaning":"Hundred points, 100%","section":"Shortcodes","emoticons":[":100:","100%"]},{"hexcode":"1F4A9","unicode":"U+1F4A9","unicodeInt":128169,"emoji":"💩","meaning":"Pile of poo","section":"Shortcodes","emoticons":[":poop:",":hankey:"]},{"hexcode":"2728","unicode":"U+2728","unicodeInt":10024,"emoji":"✨","meaning":"Sparkles","section":"Shortcodes","emoticons":[":sparkles:","*+*"]},{"hexcode":"1F680","unicode":"U+1F680","unicodeInt":128640,"emoji":"🚀","meaning":"Rocket","section":"Shortcodes","emoticons":[":rocket:"]}]};
    var FALLBACK_SHAPES_DATA = {"1F642":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.81,8.93],[0.0,11.5],[-9.81,8.93]],"i":[[0.0,0.0],[3.57,0.0],[2.9,1.64]],"o":[[-2.9,1.64],[-3.57,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F603":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.43,-10.59],[-4.43,-5.18],[-7.43,0.22],[-10.43,-5.18]],"i":[[-1.66,0.0],[0.0,-2.98],[1.66,0.0],[0.0,2.98]],"o":[[1.66,0.0],[0.0,2.98],[-1.66,0.0],[0.0,-2.98]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[7.43,-10.58],[10.43,-5.18],[7.43,0.23],[4.43,-5.18]],"i":[[-1.66,0.0],[0.0,-2.98],[1.66,0.0],[0.0,2.98]],"o":[[1.66,0.0],[0.0,2.98],[-1.66,0.0],[0.0,-2.98]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F606":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-10.83,-8.59],[-4.25,-4.57],[-10.83,-0.84]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.83,-8.59],[4.24,-4.57],[10.83,-0.84]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F604":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-3.6],[-8.62,-6.4],[-12.94,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-3.6],[8.62,-6.4],[4.31,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F601":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-3.6],[-8.62,-6.4],[-12.94,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-3.6],[8.62,-6.4],[4.31,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F602":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[29.76,11.34],[26.76,12.58],[23.76,11.34],[20.75,2.32],[29.76,5.34],[31.0,8.34]],"i":[[0.8,-0.8],[1.13,-0.0],[0.8,0.8],[0.0,0.06],[-2.96,-2.96],[0.0,-1.13]],"o":[[-0.8,0.8],[-1.13,0.0],[-2.97,-2.97],[0.23,0.01],[0.8,0.8],[0.0,1.13]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[-29.76,11.34],[-31.0,8.34],[-29.76,5.34],[-20.74,2.33],[-23.76,11.34],[-26.76,12.58]],"i":[[0.8,0.8],[0.0,1.13],[-0.8,0.8],[-0.06,0.0],[2.96,-2.96],[1.13,0.0]],"o":[[-0.8,-0.8],[-0.0,-1.13],[2.97,-2.97],[-0.01,0.23],[-0.8,0.8],[-1.13,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[22.85,-2.66],[22.83,-2.83],[0.13,-23.0],[-22.8,-3.08],[-22.85,-2.66]],"i":[[0.0,0.0],[0.01,0.06],[11.56,0.06],[1.55,-11.46],[0.01,-0.11]],"o":[[-0.01,-0.06],[-1.42,-11.47],[-11.56,-0.06],[-0.01,0.11],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.82,13.23],[0.0,23.0],[18.76,13.31]],"i":[[0.0,0.0],[-7.47,-0.09],[-4.35,6.03]],"o":[[4.37,6.06],[7.44,-0.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.31,-7.8],[-11.91,-10.8],[-7.38,-11.22]],"i":[[0.0,0.0],[-1.46,0.55],[-1.51,-0.43]],"o":[[0.72,-1.39],[1.4,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.31,-7.8],[7.4,-11.23]],"i":[[0.0,0.0],[3.11,-0.74]],"o":[[-1.58,-2.77],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[29.76,11.34],[26.76,12.58],[23.76,11.34],[20.75,2.32],[29.76,5.34],[31.0,8.34]],"i":[[0.8,-0.8],[1.13,-0.0],[0.8,0.8],[0.0,0.06],[-2.96,-2.96],[0.0,-1.13]],"o":[[-0.8,0.8],[-1.13,0.0],[-2.97,-2.97],[0.23,0.01],[0.8,0.8],[0.0,1.13]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-29.76,11.34],[-31.0,8.34],[-29.76,5.34],[-20.74,2.33],[-23.76,11.34],[-26.76,12.58]],"i":[[0.8,0.8],[0.0,1.13],[-0.8,0.8],[-0.06,0.0],[2.96,-2.96],[1.13,0.0]],"o":[[-0.8,-0.8],[-0.0,-1.13],[2.97,-2.97],[-0.01,0.23],[-0.8,0.8],[-1.13,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-4.31,-0.84],[-8.62,-3.64],[-12.94,-0.84]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-0.84],[8.62,-3.64],[4.31,-0.84]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F923":[{"v":[[-0.0,-24.0],[24.0,-0.0],[-0.0,24.0],[-24.0,-0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[15.58,-1.45],[16.8,2.96],[-7.88,15.08],[-10.56,11.55],[-10.46,11.5],[15.44,-1.3]],"i":[[0.0,0.0],[-0.11,-1.54],[2.05,-0.5],[0.66,1.34],[0.0,0.0],[-11.05,9.42]],"o":[[0.7,1.37],[-9.84,8.27],[-1.12,-0.99],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[16.8,2.96],[7.76,15.53],[-7.88,15.08]],"i":[[-9.84,8.27],[6.57,-3.27],[3.51,3.09]],"o":[[0.3,4.62],[-6.64,3.3],[2.05,-0.5]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[31.69,-3.09],[29.56,-0.64],[26.32,-0.42],[19.61,-7.16],[29.02,-8.46],[31.47,-6.33]],"i":[[0.36,-1.07],[1.01,-0.5],[1.07,0.36],[0.03,0.05],[-3.96,-1.33],[-0.5,-1.01]],"o":[[-0.36,1.07],[-1.01,0.5],[-3.98,-1.34],[0.21,-0.09],[1.07,0.36],[0.5,1.01]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[-21.61,23.4],[-24.05,21.26],[-24.28,18.02],[-17.54,11.32],[-16.23,20.73],[-18.36,23.18]],"i":[[1.07,0.36],[0.5,1.01],[-0.36,1.07],[-0.05,0.03],[1.33,-3.96],[1.01,-0.5]],"o":[[-1.07,-0.36],[-0.5,-1.01],[1.34,-3.98],[0.09,0.21],[-0.36,1.07],[-1.01,0.5]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[19.28,-12.55],[19.18,-12.69],[-10.12,-20.65],[-21.78,7.39],[-21.64,7.79]],"i":[[0.0,0.0],[0.03,0.05],[10.38,-5.09],[-3.71,-10.95],[-0.04,-0.1]],"o":[[-0.03,-0.05],[-6.38,-9.64],[-10.38,5.09],[0.03,0.1],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.96,20.22],[10.24,20.6],[22.72,3.57]],"i":[[0.0,0.0],[-6.73,3.25],[-1.21,7.34]],"o":[[6.61,3.48],[6.64,-3.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.58,-1.45],[16.8,2.96],[-7.88,15.08],[-10.56,11.55],[-10.46,11.5],[15.44,-1.3]],"i":[[0.0,0.0],[-0.11,-1.54],[2.05,-0.5],[0.66,1.34],[0.0,0.0],[-11.05,9.42]],"o":[[0.7,1.37],[-9.84,8.27],[-1.12,-0.99],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.8,2.96],[7.76,15.53],[-7.88,15.08]],"i":[[-9.84,8.27],[6.57,-3.27],[3.51,3.09]],"o":[[0.3,4.62],[-6.64,3.3],[2.05,-0.5]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[31.69,-3.09],[29.56,-0.64],[26.32,-0.42],[19.61,-7.16],[29.02,-8.46],[31.47,-6.33]],"i":[[0.36,-1.07],[1.01,-0.5],[1.07,0.36],[0.03,0.05],[-3.96,-1.33],[-0.5,-1.01]],"o":[[-0.36,1.07],[-1.01,0.5],[-3.98,-1.34],[0.21,-0.09],[1.07,0.36],[0.5,1.01]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-21.61,23.4],[-24.05,21.26],[-24.28,18.02],[-17.54,11.32],[-16.23,20.73],[-18.36,23.18]],"i":[[1.07,0.36],[0.5,1.01],[-0.36,1.07],[-0.05,0.03],[1.33,-3.96],[1.01,-0.5]],"o":[[-1.07,-0.36],[-0.5,-1.01],[1.34,-3.98],[0.09,0.21],[-0.36,1.07],[-1.01,0.5]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-13.52,-2.87],[-5.84,-2.21],[-10.07,4.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.88,-12.51],[1.77,-5.99],[9.33,-5.57]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60A":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.81,9.23],[-9.81,9.23]],"i":[[0.0,0.0],[5.7,4.7]],"o":[[-5.7,4.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-2.6],[-8.62,-5.4],[-12.94,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-2.6],[8.62,-5.4],[4.31,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F607":[{"v":[[0.0,24.0],[21.83,9.98],[18.16,-15.7],[17.89,-16.0],[-11.22,-21.22],[-23.29,5.78]],"i":[[-11.03,-0.0],[-3.91,8.54],[6.14,7.1],[0.09,0.1],[9.75,-5.15],[-2.66,-10.7]],"o":[[9.39,0.0],[3.91,-8.54],[-0.09,-0.1],[-7.35,-8.22],[-9.75,5.15],[2.66,10.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[9.81,9.23],[-9.81,9.23]],"i":[[0.0,0.0],[5.7,4.7]],"o":[[-5.7,4.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.77,-19.77],[-11.6,-19.86]],"i":[[0.0,0.0],[7.23,-4.22]],"o":[[-7.19,-4.28],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.36,-13.85],[-15.45,17.03],[15.57,16.92],[18.26,-13.98]],"i":[[0.0,0.0],[-8.81,-7.99],[-8.76,8.06],[7.23,9.45]],"o":[[-7.17,9.5],[8.81,7.99],[8.76,-8.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-26.45],[25.0,-21.2],[0.0,-15.95],[-25.0,-21.2]],"i":[[-13.81,0.0],[0.0,-2.9],[13.81,0.0],[0.0,2.9]],"o":[[13.81,0.0],[0.0,2.9],[-13.81,0.0],[0.0,-2.9]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-4.31,-2.6],[-8.62,-5.4],[-12.94,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-2.6],[8.62,-5.4],[4.31,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[0.0,-26.45],[25.0,-21.2],[0.0,-15.95],[-25.0,-21.2]],"i":[[-13.81,0.0],[0.0,-2.9],[13.81,0.0],[0.0,2.9]],"o":[[13.81,0.0],[0.0,2.9],[-13.81,0.0],[0.0,-2.9]],"c":true,"s":[0.3804,0.698,0.8941],"sw":2.1}],"1F608":[{"v":[[12.86,-20.0],[15.86,-29.0],[18.86,-14.0]],"i":[[0.0,0.0],[1.0,4.0],[3.0,-5.0]],"o":[[3.0,-2.0],[7.0,2.0],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[-12.86,-20.0],[-15.86,-29.0],[-18.86,-14.0]],"i":[[0.0,0.0],[-1.0,4.0],[-3.0,-5.0]],"o":[[-3.0,-2.0],[-7.0,2.0],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-11.0],[-6.0,-7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-11.0],[6.0,-7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[12.86,-20.0],[15.86,-29.0],[18.86,-14.0]],"i":[[0.0,0.0],[1.0,4.0],[3.0,-5.0]],"o":[[3.0,-2.0],[7.0,2.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.86,-20.0],[-15.86,-29.0],[-18.86,-14.0]],"i":[[0.0,0.0],[-1.0,4.0],[-3.0,-5.0]],"o":[[-3.0,-2.0],[-7.0,2.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,7.0],[-0.34,8.0],[-6.5,7.0]],"i":[[0.0,0.0],[2.86,0.03],[1.17,0.58]],"o":[[-1.28,0.64],[-2.62,-0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F609":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[2.25,15.02],[5.28,13.68],[6.45,12.23],[6.76,10.62],[3.06,10.67],[-6.9,10.67],[-5.59,13.68],[-2.43,15.02]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-15.35,-5.97],[-12.69,-9.61],[-8.37,-10.99]],"i":[[0.0,0.0],[-1.31,0.84],[-1.56,-0.1]],"o":[[0.41,-1.5],[1.22,-0.98],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.0,-4.91],[6.49,-6.08]],"i":[[0.0,0.0],[2.78,-1.54]],"o":[[-2.26,-2.24],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.78,9.77],[-0.15,15.04],[-7.11,9.77]],"i":[[0.0,0.0],[4.63,0.0],[0.0,2.93]],"o":[[0.0,2.94],[-4.63,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.06,9.77],[6.69,9.82]],"i":[[0.0,0.0],[-6.7,2.47]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.0,-0.14],[8.13,-1.06],[4.95,-0.29]],"i":[[0.0,0.0],[1.02,0.05],[0.99,-0.49]],"o":[[-0.86,-0.55],[-1.1,0.02],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.92,-3.69],[-4.92,-0.69],[-7.92,2.31],[-10.92,-0.69]],"i":[[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,1.66]],"o":[[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60D":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-9.5,-8.56],[-15.62,-7.24],[-14.98,-5.43],[-9.66,0.99],[-9.66,0.99],[-4.44,-5.27],[-3.53,-7.76],[-9.66,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.08,-3.23]],"o":[[-1.27,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.58,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[9.8,-8.56],[3.74,-7.24],[4.37,-5.43],[9.65,0.99],[9.65,0.99],[14.82,-5.27],[15.72,-7.76],[9.64,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.07,-3.23]],"o":[[-1.25,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.57,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[12.59,6.67],[0.03,16.78],[-12.58,6.67]],"i":[[-12.14,3.03],[8.38,0.0],[0.0,5.62]],"o":[[0.0,5.63],[-8.37,0.0],[-0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[12.59,6.67],[0.03,16.78],[-12.58,6.67]],"i":[[-12.14,3.03],[8.38,0.0],[0.0,5.62]],"o":[[0.0,5.63],[-8.37,0.0],[-0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-9.5,-8.56],[-15.62,-7.24],[-14.98,-5.43],[-9.66,0.99],[-9.66,0.99],[-4.44,-5.27],[-3.53,-7.76],[-9.66,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.08,-3.23]],"o":[[-1.27,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.58,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.8,-8.56],[3.74,-7.24],[4.37,-5.43],[9.65,0.99],[9.65,0.99],[14.82,-5.27],[15.72,-7.76],[9.64,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.07,-3.23]],"o":[[-1.25,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.57,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60E":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[9.33,2.56],[16.51,-3.83],[15.66,-8.51],[9.33,-10.21],[2.88,-8.51],[2.15,-3.83]],"i":[[-3.97,0.0],[0.0,3.53],[1.3,1.16],[1.98,0.0],[1.31,-1.56],[0.0,-1.43]],"o":[[3.96,0.0],[0.0,-1.76],[-1.3,-1.16],[-2.36,0.0],[-0.89,1.07],[0.0,3.53]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[-10.26,2.56],[-3.08,-3.83],[-3.94,-8.51],[-10.26,-10.21],[-16.71,-8.51],[-17.44,-3.83]],"i":[[-3.97,0.0],[0.0,3.53],[1.3,1.16],[1.98,0.0],[1.31,-1.56],[0.0,-1.43]],"o":[[3.96,0.0],[0.0,-1.76],[-1.3,-1.16],[-2.36,0.0],[-0.89,1.07],[0.0,3.53]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[-0.11,-22.94],[22.89,0.06],[-0.11,23.06],[-23.11,0.06]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.7,8.86],[-9.93,8.86]],"i":[[0.0,0.0],[5.58,3.66]],"o":[[-6.57,3.52],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-17.12,-5.54],[-10.26,2.38],[-2.39,-5.96],[-3.2,-8.59],[-13.15,-10.01]],"i":[[0.53,-4.57],[-7.81,0.63],[-0.05,7.69],[0.8,1.03],[6.37,-0.55]],"o":[[0.0,0.0],[2.62,-0.21],[0.0,-0.7],[-1.06,-1.37],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-17.05,-6.07],[-17.48,-9.44],[-13.65,-9.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.74,-5.54],[9.88,2.38],[2.01,-5.96],[2.82,-8.59],[12.77,-10.01]],"i":[[-0.53,-4.57],[7.81,0.63],[0.05,7.69],[-0.8,1.03],[-6.37,-0.55]],"o":[[0.0,0.0],[-2.62,-0.21],[-0.0,-0.7],[1.06,-1.37],[-0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.5,-9.58],[4.16,-9.58]],"i":[[0.0,0.0],[-4.53,2.53]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.46,-4.68],[2.07,-4.68]],"i":[[0.0,0.0],[-2.33,-3.75]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.66,-6.07],[17.1,-9.44],[13.26,-9.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.05,-5.97],[1.65,-5.97]],"i":[[0.0,0.0],[-1.9,-3.75]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60F":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.06,10.66],[10.92,6.53]],"i":[[0.0,0.0],[-0.31,4.55]],"o":[[8.5,0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.93,-9.23],[10.97,-9.8],[14.7,-8.08]],"i":[[0.0,0.0],[-2.52,-0.53],[-1.31,-0.9]],"o":[[0.47,-0.25],[2.12,0.39],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.71,-7.3],[-9.29,-9.98],[-4.93,-9.3]],"i":[[0.0,0.0],[-2.63,0.44],[-0.56,-0.29]],"o":[[0.33,-0.43],[2.13,-0.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.0,-3.0],[-7.0,0.0],[-10.0,-3.0],[-7.0,-6.0],[-4.0,-3.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.0,-3.0],[11.0,0.0],[8.0,-3.0],[11.0,-6.0],[14.0,-3.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F610":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-9.0,7.0],[9.0,7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F612":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-5.91,7.09],[2.42,5.99],[10.0,8.93]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[3.13,-0.79],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.71,-9.3],[-8.29,-11.98],[-3.93,-11.3]],"i":[[0.0,0.0],[-2.63,0.44],[-0.56,-0.29]],"o":[[0.33,-0.43],[2.13,-0.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.93,-11.0],[11.97,-11.57],[15.7,-9.85]],"i":[[0.0,0.0],[-2.52,-0.53],[-1.31,-0.9]],"o":[[0.47,-0.25],[2.12,0.39],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.0,-5.0],[-7.0,-2.0],[-10.0,-5.0],[-7.0,-8.0],[-4.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.0,-5.0],[11.0,-2.0],[8.0,-5.0],[11.0,-8.0],[14.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F615":[{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,-0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[8.7,7.92],[-8.7,9.82]],"i":[[0.0,0.0],[5.99,-2.81]],"o":[[-6.33,-1.74],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F618":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[17.01,8.47],[12.52,10.9],[12.48,12.85],[12.59,13.2],[16.39,22.92],[24.95,16.84],[26.22,14.99],[23.79,10.49],[20.09,11.53],[19.77,11.61],[19.55,11.36]],"i":[[1.34,0.4],[0.57,-1.91],[-0.17,-0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.22,0.74],[1.91,0.57],[0.95,-1.04],[0.12,0.03],[0.02,0.12]],"o":[[-1.91,-0.57],[-0.19,0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.61,-0.46],[0.57,-1.91],[-1.34,-0.4],[-0.08,0.09],[-0.12,-0.03],[-0.22,-1.38]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-15.41,-5.99],[-12.74,-9.65],[-8.4,-11.03]],"i":[[0.0,0.0],[-1.31,0.85],[-1.57,-0.09]],"o":[[0.41,-1.51],[1.22,-0.98],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.06,-4.93],[6.52,-6.11]],"i":[[0.0,0.0],[2.79,-1.55]],"o":[[-2.27,-2.24],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.04,-0.14],[8.16,-1.07],[4.97,-0.29]],"i":[[0.0,0.0],[1.11,0.02],[1.07,-0.47]],"o":[[-0.81,-0.47],[-1.12,-0.02],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[22.37,5.36],[23.0,0.0],[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[10.09,20.67]],"i":[[0.0,0.0],[0.0,1.85],[12.7,0.0],[0.0,-12.7],[-12.7,0.0],[-3.05,1.49]],"o":[[0.41,-1.72],[0.0,-12.7],[-12.7,0.0],[0.0,12.7],[3.62,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.96,-3.69],[-4.96,-0.69],[-7.96,2.31],[-10.96,-0.69]],"i":[[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,1.66]],"o":[[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.41,5.09],[0.41,10.65],[0.41,15.57]],"i":[[0.0,0.0],[10.52,-2.37],[10.46,-1.92]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[17.01,8.47],[12.52,10.9],[12.48,12.85],[12.59,13.2],[16.39,22.92],[24.95,16.84],[26.22,14.99],[23.79,10.49],[20.09,11.53],[19.77,11.61],[19.55,11.36]],"i":[[1.34,0.4],[0.57,-1.91],[-0.17,-0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.22,0.74],[1.91,0.57],[0.95,-1.04],[0.12,0.03],[0.02,0.12]],"o":[[-1.91,-0.57],[-0.19,0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.61,-0.46],[0.57,-1.91],[-1.34,-0.4],[-0.08,0.09],[-0.12,-0.03],[-0.22,-1.38]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F61B":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[5.67,10.59],[10.17,5.82],[-0.41,7.36],[-9.93,5.82],[-10.16,5.82],[-5.25,10.79]],"i":[[0.0,0.0],[-0.87,2.02],[4.42,0.05],[1.81,0.9],[0.0,0.0],[-2.2,-1.07]],"o":[[2.02,-1.09],[-1.98,0.99],[-4.05,-0.05],[0.0,0.0],[0.94,2.16],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[5.58,6.82],[-0.08,17.82],[-5.74,6.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"p":[{"v":[[-5.25,10.79],[-10.17,5.82]],"i":[[0.0,0.0],[0.94,2.16]],"o":[[-2.2,-1.07],[0.0,0.0]],"c":false},{"v":[[10.16,5.82],[5.67,10.59]],"i":[[0.0,0.0],[2.02,-1.09]],"o":[[-0.87,2.02],[0.0,0.0]],"c":false},{"v":[[-9.93,5.82],[-0.41,7.36],[10.16,5.82]],"i":[[0.0,0.0],[-4.05,-0.05],[-1.98,0.99]],"o":[[1.81,0.9],[4.42,0.05],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.66,6.82],[0.0,17.82],[-5.65,6.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F61C":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[5.67,9.59],[10.17,4.82],[-0.41,6.36],[-9.93,4.82],[-10.16,4.82],[-5.25,9.79]],"i":[[0.0,0.0],[-0.87,2.02],[4.42,0.05],[1.81,0.9],[0.0,0.0],[-2.2,-1.07]],"o":[[2.02,-1.09],[-1.98,0.99],[-4.05,-0.05],[0.0,0.0],[0.94,2.16],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[5.58,5.82],[-0.08,16.82],[-5.74,5.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[4.0,-4.27],[8.91,-5.91],[13.0,-4.27]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"p":[{"v":[[-5.25,9.79],[-10.17,4.82]],"i":[[0.0,0.0],[0.94,2.16]],"o":[[-2.2,-1.07],[0.0,0.0]],"c":false},{"v":[[10.16,4.82],[5.67,9.59]],"i":[[0.0,0.0],[2.02,-1.09]],"o":[[-0.87,2.02],[0.0,0.0]],"c":false},{"v":[[-9.93,4.82],[-0.41,6.36],[10.16,4.82]],"i":[[0.0,0.0],[-4.05,-0.05],[-1.98,0.99]],"o":[[1.81,0.9],[4.42,0.05],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.66,5.82],[0.0,16.82],[-5.65,5.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F620":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-12.0],[-6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-12.0],[6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.5,7.0],[0.34,6.0],[6.5,7.0]],"i":[[0.0,0.0],[-2.86,-0.03],[-1.17,-0.58]],"o":[[1.28,-0.64],[2.62,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F621":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.8863,0.4392,0.1333]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-8.0,10.0],[0.42,6.0],[8.0,10.0]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[1.58,-2.56],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-12.0],[-6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-12.0],[6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F622":[{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,-0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-13.23,-2.18],[-16.52,3.74],[-13.88,6.79],[-10.83,4.16],[-10.83,4.16]],"i":[[0.91,1.25],[0.18,-2.43],[-1.52,-0.11],[-0.12,1.57],[0.0,0.0]],"o":[[-1.08,1.1],[-0.11,1.52],[1.57,0.11],[0.0,0.0],[0.18,-2.43]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-9.5,12.0],[0.5,6.0],[9.5,12.0]],"i":[[0.0,0.0],[-4.18,-0.2],[-1.71,-3.51]],"o":[[1.88,-3.83],[3.83,0.18],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.61,5.63],[-16.44,3.64],[-14.0,-1.31],[-13.25,-1.31],[-10.8,3.64],[-10.8,3.64],[-13.62,6.45]],"i":[[0.53,0.53],[-0.0,0.75],[-0.1,0.1],[-0.21,-0.21],[-0.0,-2.48],[0.0,0.0],[1.55,0.0]],"o":[[-0.53,-0.53],[0.0,-2.48],[0.21,-0.21],[0.1,0.1],[0.0,0.0],[-0.0,1.55],[-0.75,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F62D":[{"v":[[16.0,16.38],[17.0,9.0],[13.0,-2.0]],"i":[[0.0,0.0],[0.0,2.0],[0.0,0.0]],"o":[[0.88,-1.63],[0.0,-4.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[8.0,0.0],[11.0,10.0],[10.0,20.0]],"i":[[0.0,0.0],[0.0,-3.27],[0.0,-2.0]],"o":[[0.0,0.0],[0.0,3.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,16.4],[-17.0,9.0],[-13.0,-2.0]],"i":[[0.0,0.0],[0.0,2.0],[0.0,0.0]],"o":[[-0.88,-1.63],[0.0,-4.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-8.0,0.0],[-11.0,10.0],[-10.0,20.0]],"i":[[0.0,0.0],[0.0,-3.27],[0.0,-2.0]],"o":[[0.0,0.0],[0.0,3.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.07,15.58],[-4.81,10.59],[0.09,5.93],[4.79,10.76],[-0.07,15.58]],"i":[[0.0,0.0],[0.0,2.62],[-2.46,0.0],[0.0,-2.62],[2.46,0.0]],"o":[[-2.46,0.0],[0.0,-2.62],[2.46,0.0],[0.0,2.62],[0.0,0.0]],"c":true,"f":[0.0,0.0,0.0]},{"v":[[-4.63,9.29],[4.63,9.29],[0.0,5.28]],"i":[[0.0,0.0],[-1.94,1.29],[0.0,0.0]],"o":[[2.03,1.29],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-6.3,-3.98],[-10.0,20.0],[-16.0,16.0],[-13.5,-3.18],[-6.3,-3.98]],"i":[[0.0,0.0],[-0.16,-9.71],[0.85,1.59],[-2.9,5.37],[-0.2,-1.28]],"o":[[-5.76,9.54],[0.0,1.8],[-2.17,-5.92],[2.89,-1.62],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[6.3,-3.6],[10.0,19.38],[16.25,15.38],[13.5,-2.8],[6.3,-3.6]],"i":[[0.0,0.0],[0.16,-9.71],[-0.85,1.59],[2.9,5.37],[0.2,-1.28]],"o":[[5.76,9.54],[0.0,1.8],[2.17,-5.92],[-2.89,-1.62],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[4.5,-3.18],[9.41,-4.82],[13.5,-3.18]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.5,-3.18],[-8.59,-4.82],[-4.5,-3.18]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[0.0,5.84],[4.76,10.6],[0.0,15.36],[-4.76,10.6]],"i":[[-2.63,0.0],[0.0,-2.63],[2.63,0.0],[0.0,2.63]],"o":[[2.63,0.0],[0.0,2.63],[-2.63,0.0],[0.0,-2.63]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F62E":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,5.6],[5.75,11.34],[0.0,17.09],[-5.75,11.34]],"i":[[-3.17,0.0],[0.0,-3.17],[3.17,0.0],[0.0,3.17]],"o":[[3.17,0.0],[0.0,3.17],[-3.17,0.0],[0.0,-3.17]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,5.6],[5.75,11.34],[0.0,17.09],[-5.75,11.34]],"i":[[-3.17,0.0],[0.0,-3.17],[3.17,0.0],[0.0,3.17]],"o":[[3.17,0.0],[0.0,3.17],[-3.17,0.0],[0.0,-3.17]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F633":[{"v":[[-18.0,3.88],[-16.0,1.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,7.88],[-12.0,3.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[18.0,3.88],[16.0,1.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[16.0,7.88],[12.0,3.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-2.5,-3.69],[-9.0,2.81],[-15.5,-3.69],[-9.0,-10.19],[-2.5,-3.69]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[15.5,-3.69],[9.0,2.81],[2.5,-3.69],[9.0,-10.19],[15.5,-3.69]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[-18.0,6.55],[-16.0,4.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,10.55],[-12.0,6.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[18.0,6.55],[16.0,4.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[16.0,10.55],[12.0,6.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[-6.44,-3.57],[-9.0,-1.01],[-11.55,-3.57],[-9.0,-6.13],[-6.44,-3.57]],"i":[[0.0,0.0],[1.41,0.0],[0.0,1.41],[-1.41,0.0],[0.0,-1.41]],"o":[[0.0,1.41],[-1.41,0.0],[0.0,-1.41],[1.41,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[11.56,-3.57],[9.0,-1.01],[6.45,-3.57],[9.0,-6.13],[11.56,-3.57]],"i":[[0.0,0.0],[1.41,0.0],[0.0,1.41],[-1.41,0.0],[0.0,-1.41]],"o":[[0.0,1.41],[-1.41,0.0],[0.0,-1.41],[1.41,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-2.5,-3.57],[-9.0,2.93],[-15.5,-3.57],[-9.0,-10.07],[-2.5,-3.57]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[15.5,-3.57],[9.0,2.93],[2.5,-3.57],[9.0,-10.07],[15.5,-3.57]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-14.31,-13.56],[-9.73,-15.96],[-5.43,-15.01]],"i":[[0.0,0.0],[-2.65,0.28],[-0.54,-0.32]],"o":[[0.35,-0.41],[2.15,-0.22],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.43,-15.03],[10.54,-15.84],[14.31,-13.56]],"i":[[0.0,0.0],[-2.6,-0.59],[-0.41,-0.48]],"o":[[0.46,-0.27],[2.11,0.48],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,10.5],[-6.5,10.5]],"i":[[0.0,0.0],[1.17,0.58]],"o":[[-1.28,0.64],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F634":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,8.74],[3.4,12.14],[0.0,15.55],[-3.4,12.14]],"i":[[-1.88,0.0],[0.0,-1.88],[1.88,0.0],[0.0,1.88]],"o":[[1.88,0.0],[0.0,1.88],[-1.88,0.0],[0.0,-1.88]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[8.77,-21.27],[7.65,-21.7],[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0],[21.56,-8.03]],"i":[[0.0,0.0],[0.38,0.13],[2.68,0.0],[0.0,-12.7],[-12.7,0.0],[0.0,12.7],[0.93,2.5]],"o":[[-0.37,-0.15],[-2.39,-0.84],[-12.7,0.0],[0.0,12.7],[12.7,0.0],[0.0,-2.82],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,8.74],[3.4,12.14],[0.0,15.55],[-3.4,12.14]],"i":[[-1.88,0.0],[0.0,-1.88],[1.88,0.0],[0.0,1.88]],"o":[[1.88,0.0],[0.0,1.88],[-1.88,0.0],[0.0,-1.88]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.17,-3.14],[4.17,-3.14]],"i":[[0.0,0.0],[2.54,2.06]],"o":[[-3.18,2.34],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.17,-3.14],[-14.17,-3.14]],"i":[[0.0,0.0],[2.54,2.06]],"o":[[-3.18,2.34],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[8.87,-11.97],[6.26,-11.97],[5.39,-12.47],[5.39,-13.47],[7.15,-16.55],[6.26,-16.55],[5.26,-17.55],[6.26,-18.55],[8.87,-18.55],[9.74,-18.05],[9.74,-17.06],[7.98,-13.97],[8.87,-13.97],[9.87,-12.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[15.02,-15.97],[11.26,-15.97],[10.39,-16.47],[10.39,-17.47],[13.29,-22.55],[11.26,-22.55],[10.26,-23.55],[11.26,-24.55],[15.02,-24.55],[15.88,-24.05],[15.89,-23.06],[12.98,-17.97],[15.02,-17.97],[16.02,-16.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[23.16,-10.97],[18.26,-10.97],[17.39,-11.47],[17.39,-12.47],[21.44,-19.55],[18.26,-19.55],[17.26,-20.55],[18.26,-21.55],[23.16,-21.55],[24.03,-21.05],[24.03,-20.06],[19.98,-12.97],[23.16,-12.97],[24.16,-11.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[8.87,-11.97],[6.26,-11.97],[5.39,-12.47],[5.39,-13.47],[7.15,-16.55],[6.26,-16.55],[5.26,-17.55],[6.26,-18.55],[8.87,-18.55],[9.74,-18.05],[9.74,-17.06],[7.98,-13.97],[8.87,-13.97],[9.87,-12.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1},{"v":[[15.02,-15.97],[11.26,-15.97],[10.39,-16.47],[10.39,-17.47],[13.29,-22.55],[11.26,-22.55],[10.26,-23.55],[11.26,-24.55],[15.02,-24.55],[15.88,-24.05],[15.89,-23.06],[12.98,-17.97],[15.02,-17.97],[16.02,-16.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1},{"v":[[23.16,-10.97],[18.26,-10.97],[17.39,-11.47],[17.39,-12.47],[21.44,-19.55],[18.26,-19.55],[17.26,-20.55],[18.26,-21.55],[23.16,-21.55],[24.03,-21.05],[24.03,-20.06],[19.98,-12.97],[23.16,-12.97],[24.16,-11.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1}],"1F635":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.5,7.0],[0.34,6.0],[6.5,7.0]],"i":[[0.0,0.0],[-2.86,-0.03],[-1.17,-0.58]],"o":[[1.28,-0.64],[2.62,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.5,-7.0],[6.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,-7.0],[11.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.5,-7.0],[-11.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-11.5,-7.0],[-6.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F641":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-8.0,10.0],[0.42,6.0],[8.0,10.0]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[1.58,-2.56],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F63A":[{"v":[[22.67,12.83],[-0.54,27.99],[-23.4,13.02],[-23.52,12.71],[-25.48,3.08],[-21.81,-30.29],[-10.58,-19.21],[-1.07,-21.15],[-0.01,-21.15],[9.5,-19.21],[20.73,-30.29],[24.45,3.58],[22.68,12.84]],"i":[[0.0,0.0],[10.58,0.0],[3.6,9.12],[0.0,0.0],[0.0,3.27],[0.0,0.0],[0.0,0.0],[-3.37,0.0],[0.0,0.0],[-2.92,-1.25],[0.0,0.0],[0.0,0.0],[1.14,-2.86]],"o":[[-3.6,9.12],[-9.12,0.0],[0.0,0.0],[-1.14,-2.86],[0.0,0.0],[0.0,0.0],[2.92,-1.25],[0.0,0.0],[3.37,0.0],[0.0,0.0],[0.0,0.0],[0.0,3.27],[0.0,0.0]],"c":false,"f":[0.9569,0.6667,0.2549]},{"v":[[-0.54,27.99],[23.41,12.87],[23.52,12.63],[25.48,2.47],[20.73,-30.29]],"i":[[0.0,0.0],[-3.6,9.12],[0.0,0.0],[0.0,3.27],[0.0,0.0]],"o":[[10.61,0.34],[0.0,0.0],[1.14,-2.86],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.8863,0.4392,0.1333]},{"v":[[19.11,-2.37],[5.85,4.25]],"i":[[0.0,0.0],[3.98,-15.9]],"o":[[0.0,0.0],[10.6,7.95]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-19.11,-2.37],[-5.85,4.25]],"i":[[0.0,0.0],[-3.98,-15.9]],"o":[[0.0,0.0],[-10.6,7.95]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-10.4,12.52],[0.0,9.4],[10.8,12.47],[7.32,17.71],[-6.35,17.82]],"i":[[0.0,0.0],[-2.6,7.28],[0.0,0.0],[0.79,-0.85],[4.27,3.94]],"o":[[0.0,0.0],[2.6,7.28],[0.0,0.0],[-4.02,4.31],[-0.94,-0.86]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[19.11,-2.31],[5.85,4.31]],"i":[[0.0,0.0],[3.98,-15.9]],"o":[[0.0,0.0],[10.6,7.95]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[26.0,18.13],[16.64,12.93]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[21.84,23.33],[12.48,18.13]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.71,12.0],[-24.44,3.05],[-20.8,-29.71],[-9.82,-19.0],[-0.52,-20.87],[0.52,-20.87],[9.82,-19.0],[20.8,-29.71],[24.44,3.05],[22.71,12.0]],"i":[[0.0,0.0],[0.0,3.16],[0.0,0.0],[0.0,0.0],[-3.3,0.0],[0.0,0.0],[-2.86,-1.21],[0.0,0.0],[0.0,0.0],[1.12,-2.77]],"o":[[-1.12,-2.77],[0.0,0.0],[0.0,0.0],[2.86,-1.21],[0.0,0.0],[3.3,0.0],[0.0,0.0],[0.0,0.0],[0.0,3.16],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-19.11,-2.31],[-5.85,4.31]],"i":[[0.0,0.0],[-3.98,-15.9]],"o":[[0.0,0.0],[-10.6,7.95]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-26.0,18.13],[-16.64,12.93]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-21.84,23.33],[-12.48,18.13]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.48,-1.63],[-10.4,0.45],[-12.48,2.53],[-14.56,0.45]],"i":[[-1.15,0.0],[0.0,-1.15],[1.15,0.0],[0.0,1.15]],"o":[[1.15,0.0],[0.0,1.15],[-1.15,0.0],[0.0,-1.15]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.48,-1.63],[14.56,0.45],[12.48,2.53],[10.4,0.45]],"i":[[-1.15,0.0],[0.0,-1.15],[1.15,0.0],[0.0,1.15]],"o":[[1.15,0.0],[0.0,1.15],[-1.15,0.0],[0.0,-1.15]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[-4.36,9.47],[3.96,9.47]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.6,12.59],[-0.2,9.47],[10.6,12.54],[7.12,17.77],[-6.56,17.89]],"i":[[0.0,0.0],[-2.6,7.28],[0.0,0.0],[0.79,-0.85],[4.27,3.94]],"o":[[0.0,0.0],[2.6,7.28],[0.0,0.0],[-4.02,4.31],[-0.94,-0.86]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.15,23.39],[-0.52,27.0],[0.52,27.0],[13.15,23.39]],"i":[[0.0,0.0],[-4.64,0.0],[0.0,0.0],[-3.66,2.29]],"o":[[3.66,2.29],[0.0,0.0],[4.64,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F929":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-10.96,-14.76],[-2.97,-15.96],[-6.88,-8.89],[-3.27,-1.67],[-11.2,-3.2],[-16.95,2.47],[-17.95,-5.55],[-25.11,-9.27],[-17.8,-12.69],[-16.47,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.88,-14.76],[2.9,-15.96],[6.8,-8.89],[3.19,-1.67],[11.12,-3.2],[16.88,2.47],[17.87,-5.55],[25.04,-9.27],[17.72,-12.69],[16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[13.74,10.36],[0.04,17.59],[-13.76,10.23]],"i":[[-12.52,3.04],[7.35,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.03,0.46]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[14.61,5.87],[13.74,10.36],[-13.76,10.23],[-14.59,5.87],[-14.48,5.87],[14.41,5.94]],"i":[[0.0,0.0],[0.58,-1.38],[2.03,0.46],[0.0,1.54],[0.0,0.0],[-14.08,3.52]],"o":[[0.0,1.6],[-12.52,3.04],[-0.55,-1.35],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[14.61,5.87],[13.74,10.36],[-13.76,10.23],[-14.59,5.87],[-14.48,5.87],[14.41,5.94]],"i":[[0.0,0.0],[0.58,-1.38],[2.03,0.46],[0.0,1.54],[0.0,0.0],[-14.08,3.52]],"o":[[0.0,1.6],[-12.52,3.04],[-0.55,-1.35],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.74,10.36],[0.04,17.59],[-13.76,10.23]],"i":[[-12.52,3.04],[7.35,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.03,0.46]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[14.23,10.24],[13.74,10.36]],"i":[[0.0,0.0],[0.16,-0.04]],"o":[[-0.16,0.04],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-13.76,10.23],[-14.04,10.16]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[-0.19,-0.05],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[10.55,-20.44],[0.0,-23.0],[-10.93,-20.24],[-11.08,-20.16]],"i":[[0.0,0.0],[3.8,0.0],[3.25,-1.76],[0.05,-0.03]],"o":[[-3.16,-1.64],[-3.95,0.0],[-0.05,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.81,-3.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0],[22.81,-2.97]],"i":[[0.0,0.0],[0.0,-1.02],[-12.7,0.0],[0.0,12.7],[0.13,0.97]],"o":[[-0.13,0.98],[0.0,12.7],[12.7,0.0],[0.0,-1.01],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.88,-14.76],[-2.9,-15.96],[-6.8,-8.89],[-3.19,-1.67],[-11.12,-3.2],[-16.88,2.47],[-17.87,-5.55],[-25.04,-9.27],[-17.72,-12.69],[-16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.88,-14.76],[2.9,-15.96],[6.8,-8.89],[3.19,-1.67],[11.12,-3.2],[16.88,2.47],[17.87,-5.55],[25.04,-9.27],[17.72,-12.69],[16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F914":[{"v":[[0.0,-23.8],[24.0,0.2],[0.0,24.2],[-24.0,0.2]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-16.9,26.3],[-17.2,22.7],[-14.5,15.4],[-12.1,10.6],[-11.0,11.3],[-11.6,19.0],[-2.2,16.2],[5.7,15.2],[-1.8,19.6],[-0.9,20.9],[-1.9,22.1],[-1.3,23.5],[-4.1,25.8],[-4.0,28.5],[-8.8,29.9],[-14.0,29.8]],"i":[[0.6,1.5],[-0.1,1.2],[-0.4,0.8],[-1.0,0.3],[0.1,-0.6],[0.0,0.0],[0.0,0.0],[-0.2,-0.9],[2.1,0.1],[0.2,-0.7],[0.2,0.0],[-0.1,-0.9],[0.0,0.0],[3.2,-0.6],[0.0,0.0],[1.9,1.3]],"o":[[-0.3,-1.2],[0.2,-1.1],[0.4,-0.8],[1.0,-0.3],[-0.1,0.6],[0.0,0.0],[0.0,0.0],[2.1,2.0],[0.0,0.0],[-0.2,0.7],[-0.2,0.0],[0.9,1.8],[1.3,-0.2],[-1.0,0.3],[0.0,0.0],[-1.2,-0.8]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-7.1,8.5],[7.0,10.6]],"i":[[0.0,0.0],[-2.2,-1.6]],"o":[[2.4,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.6,-13.5],[-9.2,-14.6],[-5.0,-12.9]],"i":[[0.0,0.0],[-1.6,-0.2],[-1.1,-1.1]],"o":[[1.3,-0.9],[1.6,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.1,-9.5],[6.9,-9.8]],"i":[[0.0,0.0],[2.7,-0.5]],"o":[[-2.7,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.0,22.4],[22.2,-5.8],[-6.0,-22.0],[-23.0,0.2],[-19.0,13.2]],"i":[[0.0,0.0],[3.3,12.3],[12.3,-3.3],[0.0,-10.4],[-2.6,-3.8]],"o":[[12.3,-3.3],[-3.3,-12.3],[-10.0,2.7],[0.0,4.6],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.0,-5.3],[-8.0,-2.3],[-11.0,-5.3],[-8.0,-8.3],[-5.0,-5.3]],"i":[[0.0,0.0],[1.7,0.0],[0.0,1.7],[-1.7,0.0],[0.0,-1.7]],"o":[[0.0,1.7],[-1.7,0.0],[0.0,-1.7],[1.7,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-2.3],[9.0,0.7],[6.0,-2.3],[9.0,-5.3],[12.0,-2.3]],"i":[[0.0,0.0],[1.7,0.0],[0.0,1.7],[-1.7,0.0],[0.0,-1.7]],"o":[[0.0,1.7],[-1.7,0.0],[0.0,-1.7],[1.7,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-16.3,20.7],[-16.8,26.2],[-9.6,30.4],[-4.7,29.0],[-3.7,28.7],[-2.6,26.9],[-2.6,26.9],[-3.8,25.9],[-2.6,25.6],[-1.5,23.8],[-2.7,22.7],[-1.5,22.3],[-0.4,20.5],[-1.4,19.5],[5.0,17.6],[6.1,15.8],[4.3,14.7],[4.3,14.7],[-5.9,17.7],[-11.0,19.2],[-10.4,11.4],[-12.5,11.6]],"i":[[0.0,0.0],[-0.7,-1.8],[-3.2,1.0],[0.0,0.0],[0.0,0.0],[0.2,0.7],[0.0,0.0],[0.6,0.1],[0.0,0.0],[0.2,0.7],[0.6,0.1],[0.0,0.0],[0.2,0.7],[0.5,0.1],[0.0,0.0],[0.2,0.7],[0.7,-0.2],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.6,-1.4]],"o":[[-1.0,1.6],[1.1,3.3],[0.0,0.0],[0.0,0.0],[0.8,-0.2],[0.0,0.0],[-0.2,-0.5],[0.0,0.0],[0.8,-0.2],[-0.2,-0.5],[0.0,0.0],[0.8,-0.2],[-0.1,-0.5],[0.0,0.0],[0.8,-0.2],[-0.2,-0.7],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.1,-0.9],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F937":[{"v":[[-13.0,2.97],[-17.0,5.97],[-15.0,7.97],[-14.0,13.97],[-15.0,24.97],[15.0,24.97],[14.0,8.97],[17.0,5.97],[13.0,2.97]],"i":[[0.0,0.0],[0.0,-2.0],[0.0,0.0],[-0.16,-2.03],[0.0,0.0],[0.0,0.0],[-1.0,1.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.51,1.97],[0.0,2.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-2.0],[0.0,0.0]],"c":false,"f":[0.5725,0.8275,0.9608]},{"v":[[-11.0,-5.03],[0.0,8.97],[11.06,-5.03],[10.06,-10.03],[3.06,-18.03],[-9.94,-11.03]],"i":[[0.0,-5.0],[-6.06,0.0],[0.0,9.0],[0.68,1.58],[0.0,0.0],[6.0,-1.0]],"o":[[0.0,9.0],[5.94,0.0],[0.02,-1.72],[-3.0,-3.0],[-4.0,3.0],[0.0,-0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-22.03,24.97],[-19.09,12.66],[-20.03,11.41],[-24.03,8.41],[-28.03,2.41],[-28.03,0.41],[-26.03,0.41],[-22.03,4.41],[-17.03,6.41],[-14.03,11.41],[-15.03,24.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,0.55],[-0.55,-0.55],[0.0,0.0],[-3.0,-1.0],[0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,-0.55],[0.55,-0.55],[0.0,0.0],[1.0,1.0],[3.0,1.0],[-0.67,8.97],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[-16.01,6.85],[-18.13,0.96],[-20.03,0.8],[-20.03,4.49]],"i":[[0.0,0.0],[1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[-0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[22.03,24.97],[19.09,12.66],[20.03,11.41],[24.03,8.41],[28.03,2.41],[28.03,0.41],[26.03,0.41],[22.03,4.41],[17.03,6.41],[14.03,11.41],[15.03,24.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,0.55],[0.55,-0.55],[0.0,0.0],[3.0,-1.0],[-0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,-0.55],[-0.55,-0.55],[0.0,0.0],[-1.0,1.0],[-3.0,1.0],[0.67,8.97],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[16.01,6.85],[18.13,0.96],[20.03,0.8],[20.03,4.49]],"i":[[0.0,0.0],[-1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[10.2,-9.95],[2.84,-17.88],[-9.9,-10.9],[-9.95,2.96],[-13.95,-10.04],[0.05,-24.04],[14.05,-10.04],[10.05,2.96]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,7.0],[-10.0,0.0],[0.0,-7.0],[4.0,0.0]],"o":[[-2.66,-0.86],[-2.66,3.23],[-2.99,2.99],[-4.0,0.0],[0.0,-7.0],[10.0,0.0],[0.0,7.0],[1.32,-2.25]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.0,2.97],[14.0,-10.03],[0.0,-24.03],[-14.0,-10.03],[-10.0,2.97]],"i":[[0.0,0.0],[0.0,7.0],[10.0,0.0],[0.0,-7.0],[-4.0,0.0]],"o":[[4.0,0.0],[0.0,-7.0],[-10.0,0.0],[0.0,7.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.87,-6.03],[3.87,-4.03],[1.87,-6.03],[3.87,-8.03],[5.87,-6.03]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-2.13,-6.03],[-4.13,-4.03],[-6.13,-6.03],[-4.13,-8.03],[-2.13,-6.03]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-11.06,-5.03],[-0.06,8.97],[11.0,-5.03],[10.0,-10.03],[3.0,-18.03],[-10.0,-11.03]],"i":[[0.0,-5.0],[-6.06,0.0],[0.0,9.0],[0.68,1.58],[0.0,0.0],[6.0,-1.0]],"o":[[0.0,9.0],[5.94,0.0],[0.02,-1.72],[-3.0,-3.0],[-4.0,3.0],[0.0,-0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-1.92,1.97],[2.02,1.97]],"i":[[0.0,0.0],[-1.3,0.23]],"o":[[1.3,0.23],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.03,23.97],[-19.09,12.66],[-20.03,11.41],[-24.03,8.41],[-28.03,2.41],[-28.03,0.41],[-26.03,0.41],[-22.03,4.41],[-17.03,6.41],[-14.03,11.41],[-15.03,23.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,0.55],[-0.55,-0.55],[0.0,0.0],[-3.0,-1.0],[0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,-0.55],[0.55,-0.55],[0.0,0.0],[1.0,1.0],[3.0,1.0],[-0.67,8.97],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-16.01,6.85],[-18.13,0.96],[-20.03,0.8],[-20.03,4.49]],"i":[[0.0,0.0],[1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[-0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[22.03,23.97],[19.09,12.66],[20.03,11.41],[24.03,8.41],[28.03,2.41],[28.03,0.41],[26.03,0.41],[22.03,4.41],[17.03,6.41],[14.03,11.41],[15.03,23.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,0.55],[0.55,-0.55],[0.0,0.0],[3.0,-1.0],[-0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,-0.55],[-0.55,-0.55],[0.0,0.0],[-1.0,1.0],[-3.0,1.0],[0.67,8.97],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.01,6.85],[18.13,0.96],[20.03,0.8],[20.03,4.49]],"i":[[0.0,0.0],[-1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.0,3.97],[-10.0,2.97]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.0,2.97],[13.44,3.97]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F64C":[{"v":[[-15.43,-0.76],[-15.43,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[21.57,-0.05],[21.4,-18.72],[21.4,-17.95],[27.9,-17.12],[27.96,-10.69],[28.07,1.55],[27.94,-12.52],[33.59,-11.71],[33.6,12.67],[17.73,28.5],[1.78,12.56],[1.5,-2.82],[8.35,0.82],[8.35,5.71],[8.35,-17.35],[14.98,-16.78],[14.98,-19.7],[21.4,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-4.09],[0.0,0.0],[8.81,-0.0],[0.0,8.81],[0.0,7.09],[-1.2,-2.84],[0.0,0.0],[0.0,0.0],[-0.0,-4.51],[0.0,0.0],[-0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[-0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-3.17],[0.0,0.0],[0.0,8.81],[-8.81,0.0],[0.05,-3.07],[2.17,-2.17],[0.0,0.0],[0.0,0.0],[-0.0,-3.66],[0.0,0.0],[-0.0,-3.95],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[-22.02,-0.05],[-21.85,-18.72],[-21.85,-17.95],[-28.35,-17.12],[-28.41,-10.69],[-28.52,1.55],[-28.39,-12.52],[-34.04,-11.71],[-34.05,12.67],[-18.18,28.5],[-2.23,12.56],[-1.95,-2.82],[-8.8,0.82],[-8.8,5.71],[-8.8,-17.35],[-15.43,-16.78],[-15.43,-19.7],[-21.85,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-4.09],[0.0,0.0],[-8.81,-0.0],[-0.0,8.81],[-0.0,7.09],[1.2,-2.84],[0.0,0.0],[0.0,0.0],[0.0,-4.51],[0.0,0.0],[0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-3.17],[0.0,0.0],[-0.0,8.81],[8.81,0.0],[-0.05,-3.07],[-2.17,-2.17],[0.0,0.0],[0.0,0.0],[0.0,-3.66],[0.0,0.0],[0.0,-3.95],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[21.57,-0.05],[21.4,-18.72],[21.4,-17.95],[27.9,-17.12],[27.96,-10.69],[28.07,1.55],[27.94,-12.52],[33.59,-11.71],[33.6,12.67],[17.73,28.5],[1.78,12.56],[1.5,-2.82],[8.35,0.82],[8.35,5.71],[8.35,-17.35],[14.98,-16.78],[14.98,-19.7],[21.4,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-4.09],[0.0,0.0],[8.81,-0.0],[0.0,8.81],[0.0,7.09],[-1.2,-2.84],[0.0,0.0],[0.0,0.0],[-0.0,-4.51],[0.0,0.0],[-0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[-0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-3.17],[0.0,0.0],[0.0,8.81],[-8.81,0.0],[0.05,-3.07],[2.17,-2.17],[0.0,0.0],[0.0,0.0],[-0.0,-3.66],[0.0,0.0],[-0.0,-3.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.98,1.55],[14.98,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.43,1.55],[-15.43,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.02,-0.05],[-21.85,-18.72],[-21.85,-17.95],[-28.35,-17.12],[-28.41,-10.69],[-28.52,1.55],[-28.39,-12.52],[-34.04,-11.71],[-34.05,12.67],[-18.18,28.5],[-2.23,12.56],[-1.95,-2.82],[-8.8,0.82],[-8.8,5.71],[-8.8,-17.35],[-15.43,-16.78],[-15.43,-19.7],[-21.85,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-4.09],[0.0,0.0],[-8.81,-0.0],[-0.0,8.81],[-0.0,7.09],[1.2,-2.84],[0.0,0.0],[0.0,0.0],[0.0,-4.51],[0.0,0.0],[0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-3.17],[0.0,0.0],[-0.0,8.81],[8.81,0.0],[-0.05,-3.07],[-2.17,-2.17],[0.0,0.0],[0.0,0.0],[0.0,-3.66],[0.0,0.0],[0.0,-3.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1FAE1":[{"v":[[2.0,-22.3],[-21.0,0.7],[2.0,23.7],[25.0,0.7]],"i":[[12.7,0.0],[0.0,-12.7],[-12.7,0.0],[0.0,12.7]],"o":[[-12.7,0.0],[0.0,12.7],[12.7,0.0],[-0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-26.0,-1.7],[-19.4,-8.0],[-14.7,-7.2],[-9.1,-9.9],[-6.5,-12.7],[-8.7,-13.5],[-15.2,-12.5],[-1.5,-21.97],[-1.34,-22.62],[-1.5,-22.77],[-7.6,-22.5],[-20.6,-15.7],[-28.75,-9.25],[-29.65,-8.51],[-26.67,-1.7]],"i":[[0.0,0.0],[0.0,0.0],[-2.1,0.1],[-2.3,0.4],[0.7,1.3],[0.83,-0.2],[1.8,0.4],[-5.8,4.3],[0.13,0.22],[0.06,0.04],[3.2,-1.4],[0.0,0.0],[2.9,-2.2],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[1.7,1.3],[2.0,-0.1],[2.1,-0.4],[-0.5,-0.69],[-2.1,0.5],[0.0,0.0],[0.22,-0.13],[-0.04,-0.06],[-0.8,-0.5],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.4,-22.1],[1.8,-22.2],[24.8,0.8],[1.8,23.8],[-21.2,0.8],[-21.2,0.8],[-20.1,-6.2]],"i":[[0.0,0.0],[-0.73,-0.02],[0.0,-12.7],[12.7,0.0],[0.0,12.7],[0.0,0.0],[-0.72,2.26]],"o":[[0.73,-0.08],[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,0.0],[0.01,-2.38],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-7.1,7.8],[-1.2,8.3],[5.0,8.3],[11.0,7.8]],"i":[[0.0,0.0],[0.0,0.0],[-2.06,0.2],[0.0,0.0]],"o":[[0.0,0.0],[2.06,0.2],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.1,-4.2],[-7.1,-1.2],[-10.1,-4.2],[-7.1,-7.2],[-7.1,-7.2],[-4.1,-4.2]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,0.0],[-0.0,-1.65]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[0.0,0.0],[1.65,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[13.9,-4.2],[10.9,-1.2],[7.9,-4.2],[10.9,-7.2],[10.9,-7.2],[13.9,-4.31],[13.9,-4.2]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,0.0],[-0.03,-1.63],[0.0,-0.04]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[0.0,0.0],[1.63,-0.03],[0.0,0.04],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-25.7,-2.0],[-18.4,-7.9],[-14.5,-6.9],[-7.4,-9.9],[-7.0,-13.3],[-14.3,-12.4],[0.1,-22.3],[-2.8,-23.55],[-7.1,-22.9],[-17.4,-17.3],[-22.8,-13.7],[-28.8,-9.0]],"i":[[0.0,0.0],[0.0,0.0],[-2.1,0.1],[-2.9,0.3],[1.7,0.2],[0.0,0.0],[-5.8,4.4],[1.88,0.27],[1.72,-0.71],[0.0,0.0],[1.67,-1.38],[1.8,-1.4]],"o":[[0.0,0.0],[1.7,1.3],[2.5,0.0],[2.7,-0.5],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.13,-0.16],[0.0,0.0],[-1.92,1.01],[-2.3,1.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"2764":[{"v":[[23.5,-11.0],[11.0,-23.5],[0.0,-16.94],[-11.0,-23.5],[-23.5,-11.0],[-20.73,-3.16],[-20.73,-3.16],[-0.0,22.54],[20.73,-3.16],[20.72,-3.16],[23.49,-11.0]],"i":[[0.0,0.0],[6.9,0.0],[2.11,-3.91],[4.75,0.0],[0.0,-6.9],[-1.73,-2.14],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.97]],"o":[[0.0,-6.9],[-4.75,0.0],[-2.11,-3.91],[-6.9,0.0],[0.0,2.97],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.73,-2.14],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[23.5,-11.0],[11.0,-23.5],[0.0,-16.94],[-11.0,-23.5],[-23.5,-11.0],[-20.73,-3.16],[-20.73,-3.16],[-0.0,22.54],[20.73,-3.16],[20.72,-3.16],[23.49,-11.0]],"i":[[0.0,0.0],[6.9,0.0],[2.11,-3.91],[4.75,0.0],[0.0,-6.9],[-1.73,-2.14],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.97]],"o":[[0.0,-6.9],[-4.75,0.0],[-2.11,-3.91],[-6.9,0.0],[0.0,2.97],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.73,-2.14],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1}],"1F494":[{"v":[[13.57,-20.39],[3.38,-14.21],[0.0,-6.32],[7.0,-0.31],[1.0,8.12],[6.0,15.0],[2.41,24.16],[22.88,-2.07],[25.09,-8.87]],"i":[[6.35,0.0],[2.0,-3.82],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.47]],"o":[[-4.32,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.44,-1.97],[0.0,-6.35]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[1.1,14.98],[-3.95,8.02],[1.98,-0.02],[-5.06,-5.97],[-3.61,-13.86],[-13.98,-20.39],[-25.5,-8.87],[-23.83,-2.89],[-23.17,-1.91],[-2.71,24.32],[-2.36,23.87]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.17,0.35],[4.45,0.0],[0.0,-6.35],[-1.09,-1.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.94,-4.03],[-6.35,0.0],[0.0,2.12],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[13.57,-20.39],[3.38,-14.21],[0.0,-6.32],[7.0,-0.31],[1.0,8.12],[6.0,15.0],[2.41,24.16],[22.88,-2.07],[25.09,-8.87]],"i":[[6.35,0.0],[2.0,-3.82],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.47]],"o":[[-4.32,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.44,-1.97],[0.0,-6.35]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.1,14.98],[-3.95,8.02],[1.98,-0.02],[-5.06,-5.97],[-3.61,-13.86],[-13.98,-20.39],[-25.5,-8.87],[-23.83,-2.89],[-23.17,-1.91],[-2.71,24.32],[-2.36,23.87]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.17,0.35],[4.45,0.0],[0.0,-6.35],[-1.09,-1.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.94,-4.03],[-6.35,0.0],[0.0,2.12],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F44D":[{"v":[[1.09,-24.77],[-1.83,-24.12],[-17.0,-6.79],[-24.33,6.27],[-22.33,17.54],[-9.4,24.61],[0.23,24.57],[14.27,24.78],[16.67,23.21],[17.42,19.38],[16.67,17.79],[20.25,17.71],[21.58,16.04],[22.42,13.71],[20.83,10.71],[22.42,10.04],[24.33,7.38],[23.42,4.63],[20.92,3.46],[22.08,1.29],[22.25,-2.12],[19.67,-3.62],[6.5,-4.12],[5.67,-4.79],[4.81,-5.39],[-4.31,-5.39],[-4.25,-7.12],[-0.33,-16.71],[1.33,-21.29]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.76,23.6],[-9.76,23.6],[-23.76,8.6],[-18.76,-4.4]],"i":[[0.0,0.0],[0.0,0.0],[0.0,8.32],[-3.2,3.58]],"o":[[0.0,0.0],[-8.32,0.0],[0.02,-4.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-1.38,-4.4],[-5.76,-4.4],[1.24,-22.4],[-3.76,-23.4],[-18.76,-4.4]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[2.21,-2.8],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.81,-2.08],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.45,-0.9],[5.45,2.6],[18.45,2.6],[22.41,-0.43],[19.38,-4.4],[18.45,-4.4],[5.45,-4.4]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[2.3,20.44],[6.3,23.94],[13.3,23.94],[17.27,20.9],[14.24,16.94],[13.31,16.94],[6.31,16.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.76,6.44],[1.24,9.94],[20.24,9.94],[24.2,6.9],[21.17,2.94],[20.24,2.94],[1.24,2.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-0.76,13.44],[3.24,16.94],[18.24,16.94],[22.2,13.9],[19.17,9.94],[18.24,9.94],[3.24,9.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-21.86,0.26],[-23.77,8.1],[-8.65,23.6]],"i":[[0.0,0.0],[0.08,-2.72],[-10.5,0.0]],"o":[[-1.18,2.45],[0.0,8.56],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F44E":[{"v":[[1.33,21.21],[-0.33,16.62],[-4.25,7.04],[-4.31,5.3],[4.81,5.3],[5.67,4.71],[6.5,4.04],[19.67,3.54],[22.25,2.04],[22.08,-1.38],[20.92,-3.54],[23.42,-4.71],[24.33,-7.46],[22.42,-10.13],[20.83,-10.79],[22.42,-13.79],[21.58,-16.13],[20.25,-17.79],[16.67,-17.88],[17.42,-19.46],[16.67,-23.29],[14.27,-24.86],[0.23,-24.65],[-9.4,-24.7],[-22.33,-17.63],[-24.33,-6.35],[-17.0,6.71],[-1.83,24.04],[1.09,24.69]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-18.76,4.32],[-23.76,-8.68],[-9.76,-23.68],[-0.76,-23.68]],"i":[[0.0,0.0],[0.02,4.8],[-8.32,0.0],[0.0,0.0]],"o":[[-3.2,-3.58],[0.0,-8.32],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.76,4.32],[-3.76,23.32],[1.24,22.32],[-5.76,4.32],[-1.37,4.32]],"i":[[0.0,0.0],[0.0,0.0],[0.81,2.08],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[2.21,2.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.45,4.32],[18.45,4.32],[19.38,4.32],[22.41,0.35],[18.45,-2.68],[5.45,-2.68],[1.45,0.82]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.3,-17.02],[13.3,-17.02],[14.24,-17.02],[17.27,-20.99],[13.3,-24.02],[6.3,-24.02],[2.3,-20.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.24,-3.02],[20.24,-3.02],[21.17,-3.02],[24.2,-6.99],[20.24,-10.02],[1.24,-10.02],[-2.76,-6.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[3.24,-10.02],[18.24,-10.02],[19.17,-10.02],[22.2,-13.99],[18.24,-17.02],[3.24,-17.02],[-0.76,-13.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.64,-23.69],[-23.77,-8.19],[-21.86,-0.35]],"i":[[0.0,0.0],[0.0,-8.56],[-1.18,-2.45]],"o":[[-10.5,0.0],[0.08,2.72],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F480":[{"v":[[5.18,-21.78],[0.01,-22.55],[-0.03,-22.55],[-3.76,-22.17],[-14.61,-15.2],[-18.51,-6.14],[-13.71,11.08],[-13.58,11.22],[-11.08,15.78],[-11.1,20.77],[-12.1,21.77],[-12.1,21.77],[-5.09,24.3],[6.44,23.99]],"i":[[3.63,14.74],[1.75,0.0],[0.0,0.0],[1.23,-0.25],[2.66,-3.56],[0.54,-3.29],[-4.11,-4.72],[0.0,0.0],[0.0,-1.73],[0.0,0.0],[0.55,0.0],[0.0,0.0],[-2.43,-0.55],[-3.76,1.07]],"o":[[-1.68,-0.51],[0.0,0.0],[-1.25,0.0],[-4.34,0.93],[-2.02,2.65],[-1.08,6.17],[0.0,0.0],[1.05,1.19],[0.0,0.0],[0.0,0.55],[0.0,0.0],[2.22,1.13],[3.81,0.86],[3.21,-15.18]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[12.89,-17.14],[5.18,-21.79],[6.44,23.98],[12.04,21.71],[11.03,20.72],[10.96,15.78],[13.38,11.46],[13.79,11.01],[12.9,-17.14]],"i":[[0.0,0.0],[2.91,0.89],[3.22,-15.17],[-1.78,0.97],[0.01,0.55],[0.0,0.0],[-1.02,1.13],[-0.12,0.14],[7.56,7.73]],"o":[[-2.15,-2.16],[3.63,14.74],[1.95,-0.54],[-0.55,0.0],[0.0,0.0],[0.0,-1.65],[0.15,-0.16],[7.05,-8.19],[0.0,0.0]],"c":true,"f":[0.8157,0.8118,0.8078]},{"v":[[-8.14,0.36],[-12.64,4.86],[-8.14,9.36],[-3.64,4.86]],"i":[[2.49,0.0],[0.0,-2.49],[-2.49,0.0],[0.0,2.49]],"o":[[-2.49,0.0],[0.0,2.49],[2.49,0.0],[0.0,-2.49]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[8.21,0.36],[3.71,4.86],[8.21,9.36],[12.71,4.86]],"i":[[2.49,0.0],[0.0,-2.49],[-2.49,0.0],[0.0,2.49]],"o":[[-2.49,0.0],[0.0,2.49],[2.49,0.0],[0.0,-2.49]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[12.02,20.66],[11.95,15.72],[14.53,11.62],[19.83,-2.62],[-0.03,-23.61],[-3.95,-23.2],[-19.5,-6.36],[-14.46,11.69],[-12.08,15.73],[-12.1,20.71]],"i":[[0.0,0.0],[0.0,0.0],[-0.93,1.07],[0.02,5.23],[10.96,-0.02],[1.29,-0.27],[1.37,-8.38],[-4.32,-4.94],[0.0,-1.42],[0.0,0.0]],"o":[[0.0,0.0],[0.0,-1.45],[3.43,-3.95],[0.0,-11.6],[-1.32,0.0],[-7.89,1.62],[-1.13,6.47],[0.92,1.04],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.14,19.0],[-8.14,23.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.42,20.07],[-2.42,24.85]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[8.21,19.0],[8.21,23.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[3.03,20.07],[3.03,24.85]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.96,16.21],[-0.03,10.36],[3.47,16.21]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.14,-0.18],[-3.14,4.82],[-8.14,9.82],[-13.14,4.82]],"i":[[-2.76,0.0],[0.0,-2.76],[2.76,0.0],[0.0,2.76]],"o":[[2.76,0.0],[0.0,2.76],[-2.76,0.0],[0.0,-2.76]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[8.21,-0.18],[13.21,4.82],[8.21,9.82],[3.21,4.82]],"i":[[-2.76,0.0],[0.0,-2.76],[2.76,0.0],[0.0,2.76]],"o":[[2.76,0.0],[0.0,2.76],[-2.76,0.0],[0.0,-2.76]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F525":[{"v":[[15.33,22.3],[17.78,-3.27],[16.8,-3.37],[14.79,-1.39],[13.45,-3.27],[-0.9,-31.81],[-2.06,-31.11],[-5.16,-17.29],[-5.82,-16.98],[-9.34,0.47],[-9.34,1.42],[-11.9,3.5],[-14.31,-4.33],[-15.51,-4.66],[-15.59,21.66],[-15.06,24.79],[-15.21,25.14],[-14.54,26.54],[-0.25,31.72],[13.58,26.99],[14.85,25.31],[15.33,22.3]],"i":[[0.0,0.0],[1.59,3.7],[0.05,-0.46],[1.6,0.39],[0.0,1.32],[3.84,3.24],[-0.11,-0.67],[1.49,0.47],[0.12,-0.25],[0.11,-3.18],[0.0,-0.27],[1.15,0.51],[0.01,1.45],[0.39,-0.55],[-2.24,-3.12],[0.37,-1.05],[0.06,-0.11],[0.0,0.0],[-8.82,0.0],[-1.88,1.67],[0.0,0.82],[-0.51,0.5]],"o":[[7.56,-9.79],[-0.18,-0.42],[-0.12,1.08],[-0.82,-0.2],[0.51,-15.05],[-0.51,-0.43],[2.46,15.33],[-0.26,-0.08],[-4.59,9.7],[0.0,0.26],[0.0,1.75],[-2.05,-0.92],[-0.0,-0.68],[-8.8,12.27],[0.65,0.9],[-0.04,0.12],[-0.4,0.8],[1.32,1.23],[7.13,-0.0],[0.88,-0.78],[-0.0,-0.98],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[0.29,-3.44],[-3.91,4.91],[-4.09,5.22],[-5.15,12.28],[-5.15,12.28],[-8.13,16.25],[-9.38,15.77],[-10.73,16.63],[-4.58,28.3],[-3.14,30.27],[-3.08,30.32],[2.2,30.32],[2.41,30.27],[5.61,26.49],[9.35,21.14],[8.72,19.94],[7.7,18.75],[7.7,18.75],[8.3,16.19],[8.66,13.83],[7.38,13.11],[4.78,12.04],[4.7,6.58],[1.87,-3.79]],"i":[[0.15,-0.75],[2.89,-4.35],[0.06,-0.11],[-0.29,-3.71],[0.0,-0.0],[2.4,0.36],[0.33,0.23],[-0.07,-0.74],[-4.55,-3.59],[-0.16,-0.92],[-0.03,0.0],[0.0,0.0],[-0.01,0.04],[-2.84,2.52],[-0.58,1.45],[0.54,0.09],[0.3,0.82],[0.0,0.0],[-0.82,1.72],[0.06,0.7],[0.56,-0.28],[0.73,1.61],[-0.57,3.89],[1.82,2.51]],"o":[[-0.29,1.46],[-0.06,0.11],[-0.31,0.69],[0.0,0.0],[-0.0,0.0],[-0.51,-0.08],[-0.61,-0.42],[0.32,3.19],[0.0,0.0],[0.01,0.03],[0.0,0.0],[0.18,0.0],[0.04,-0.24],[2.0,-1.77],[0.2,-0.51],[-0.34,-0.06],[-0.0,-0.0],[-0.01,-0.02],[0.38,-0.8],[-0.06,-0.63],[-0.78,0.4],[0.0,0.0],[0.44,-2.97],[-0.45,-0.62]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-14.37,25.56],[-0.38,31.03],[13.86,25.56]],"i":[[0.0,0.0],[-5.32,0.0],[-3.53,3.51]],"o":[[3.48,3.61],[5.05,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-14.49,21.46],[-14.94,-4.52],[-13.69,2.06],[-11.34,4.02],[-8.92,1.44],[-8.92,0.53],[-5.35,-16.66],[-1.36,-31.28],[12.92,-3.06],[15.08,-0.76],[17.24,-3.06],[14.73,21.46]],"i":[[0.0,0.0],[-10.08,14.78],[-1.06,-2.52],[-1.14,0.0],[0.0,1.67],[0.0,0.25],[-4.1,9.52],[3.05,18.4],[0.6,-17.77],[-1.19,0.0],[0.0,1.27],[8.84,-11.44]],"o":[[0.0,0.0],[0.0,0.0],[0.48,1.04],[1.34,0.0],[0.0,-0.26],[0.11,-3.1],[0.0,0.0],[0.0,0.0],[0.0,1.27],[1.19,0.0],[0.08,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.18,-13.03],[-11.26,-16.35],[-9.66,-20.18]],"i":[[0.0,0.0],[-1.21,1.04],[0.31,2.2]],"o":[[0.2,-1.04],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F4AF":[{"v":[[23.18,10.06],[-22.82,10.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[23.18,18.06],[-22.82,18.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[-3.02,1.0],[-3.02,1.0],[-9.3,-5.27],[-9.3,-15.66],[-3.02,-21.94],[-3.02,-21.94],[3.26,-15.66],[3.26,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[16.91,1.0],[16.91,1.0],[10.63,-5.27],[10.63,-15.66],[16.91,-21.94],[16.91,-21.94],[23.19,-15.66],[23.19,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[-23.02,-17.11],[-16.66,-21.87],[-16.66,1.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[23.18,10.06],[-22.82,10.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[23.18,18.06],[-22.82,18.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[-3.02,1.0],[-3.02,1.0],[-9.3,-5.27],[-9.3,-15.66],[-3.02,-21.94],[-3.02,-21.94],[3.26,-15.66],[3.26,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[16.91,1.0],[16.91,1.0],[10.63,-5.27],[10.63,-15.66],[16.91,-21.94],[16.91,-21.94],[23.19,-15.66],[23.19,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[-23.02,-17.11],[-16.66,-21.87],[-16.66,1.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2}],"1F4A9":[{"v":[[-13.0,-2.0],[-14.0,-7.0],[-11.0,-10.0],[-8.0,-12.0],[-6.0,-19.0],[-5.0,-23.0],[4.0,-18.0],[8.0,-14.0],[7.0,-9.0],[12.0,-8.0],[14.0,-5.0],[13.0,-1.0],[17.0,0.0],[20.0,3.0],[18.0,9.0],[22.0,10.0],[24.0,15.0],[19.0,20.0],[8.8,19.6],[-9.2,19.2],[-22.0,15.0],[-19.0,10.0],[-17.0,9.0],[-19.0,5.0],[-16.0,0.0]],"i":[[0.0,0.0],[-0.5,2.0],[-1.7,1.2],[-1.0,0.3],[-0.5,2.5],[-0.4,1.31],[-2.89,-1.85],[-0.5,-1.6],[0.5,-0.9],[-1.45,-1.03],[-0.23,-1.23],[0.86,-1.14],[-1.23,-0.67],[-0.61,-1.32],[1.8,-1.7],[-1.14,-0.87],[0.27,-1.9],[0.4,-0.1],[4.9,0.6],[6.0,0.0],[0.0,3.0],[-0.7,0.5],[-0.7,0.27],[0.0,1.0],[-1.9,1.8]],"o":[[0.0,0.0],[0.3,-1.2],[1.6,-1.1],[0.7,-2.5],[0.26,-1.35],[3.1,1.48],[2.3,1.5],[0.6,2.1],[1.73,-0.39],[1.05,0.68],[0.22,1.41],[1.4,-0.01],[1.32,0.61],[0.7,1.9],[1.41,-0.23],[1.51,1.19],[-0.5,3.5],[-2.2,0.7],[-4.4,-0.6],[-5.5,1.1],[0.0,-2.7],[0.63,-0.39],[-1.0,-2.0],[0.0,-1.2],[2.1,-2.1]],"c":true,"f":[0.6471,0.4745,0.2235]},{"v":[[-5.0,-23.0],[4.0,-18.0],[8.0,-14.0],[7.0,-9.0],[12.0,-8.0],[14.0,-5.0],[13.0,-1.0],[17.0,0.0],[20.0,3.0],[18.0,9.0],[22.0,10.0],[24.0,15.0],[19.0,20.0],[9.0,18.0],[17.0,15.0],[13.0,11.0],[7.0,4.0],[3.0,-5.0],[2.0,-15.0]],"i":[[4.0,2.0],[-2.89,-1.85],[-0.5,-1.6],[0.5,-0.9],[-1.45,-1.03],[-0.23,-1.23],[0.86,-1.14],[-1.23,-0.67],[-0.61,-1.32],[1.8,-1.7],[-1.14,-0.87],[0.27,-1.9],[0.4,-0.1],[-4.8,0.8],[-0.1,0.3],[2.0,0.0],[5.3,1.2],[3.8,0.9],[1.4,2.8]],"o":[[3.1,1.48],[2.3,1.5],[0.6,2.1],[1.73,-0.39],[1.05,0.68],[0.22,1.41],[1.4,-0.01],[1.32,0.61],[0.7,1.9],[1.41,-0.23],[1.51,1.19],[-0.5,3.5],[-2.2,0.7],[6.0,-1.0],[1.0,-2.0],[0.2,-3.3],[0.7,-3.2],[2.0,-4.0],[-2.0,-4.0]],"c":true,"f":[0.4157,0.2745,0.1843]},{"v":[[-8.8,-3.5],[-3.9,3.4],[-8.8,10.3],[-13.7,3.4]],"i":[[-2.71,0.0],[0.0,-3.81],[2.71,0.0],[0.0,3.81]],"o":[[2.71,0.0],[0.0,3.81],[-2.71,0.0],[0.0,-3.81]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[7.6,-4.0],[12.5,2.9],[7.6,9.8],[2.7,2.9]],"i":[[-2.71,0.0],[0.0,-3.81],[2.71,0.0],[0.0,3.81]],"o":[[2.71,0.0],[0.0,3.81],[-2.71,0.0],[0.0,-3.81]],"c":true,"f":[1.0,1.0,1.0]},{"p":[{"v":[[-17.0,9.0],[-18.0,2.0],[-13.0,-1.0]],"i":[[0.0,0.0],[-1.6,2.9],[-0.4,0.1]],"o":[[-0.1,-0.2],[1.3,-2.3],[0.0,0.0]],"c":false},{"v":[[7.0,-9.0],[8.0,-14.0],[3.0,-19.0],[-5.0,-23.0],[-5.0,-20.0],[-6.0,-15.0]],"i":[[0.0,0.0],[0.5,1.6],[4.1,2.0],[0.0,0.0],[0.19,-0.99],[0.3,-1.7]],"o":[[0.3,-0.9],[-0.4,-1.3],[0.0,0.0],[0.19,0.99],[-0.2,1.1],[0.0,0.0]],"c":false},{"v":[[18.0,9.0],[24.0,13.0],[18.0,20.0],[6.3,18.4]],"i":[[0.0,0.0],[-1.2,-3.5],[4.0,0.0],[4.2,0.4]],"o":[[0.6,0.1],[1.0,3.0],[-4.3,0.0],[0.0,0.0]],"c":false},{"v":[[-12.4,-0.9],[-13.0,-1.0],[-14.0,-5.0],[-10.0,-11.0],[-5.0,-12.0],[-1.0,-15.0]],"i":[[0.0,0.0],[0.2,0.0],[-0.06,1.4],[-2.29,1.16],[-2.3,0.9],[-1.04,1.35]],"o":[[-0.2,0.0],[-0.72,-1.21],[0.19,-2.56],[1.9,-0.9],[1.58,-0.62],[0.0,0.0]],"c":false},{"v":[[12.5,-0.3],[13.0,-1.0],[14.0,-6.0],[7.0,-9.0],[2.0,-4.0],[-4.2,-1.3]],"i":[[0.0,0.0],[-0.13,0.26],[0.7,2.1],[1.0,0.1],[1.98,-1.32],[2.22,-0.49]],"o":[[0.2,-0.21],[0.2,-0.2],[-1.0,-3.0],[-1.32,1.98],[-1.87,1.29],[0.0,0.0]],"c":false},{"v":[[-4.7,8.7],[3.8,6.3]],"i":[[0.0,0.0],[-2.68,1.26]],"o":[[2.95,-0.33],[0.0,0.0]],"c":false},{"v":[[-11.8,9.0],[-11.1,9.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false},{"v":[[14.0,-1.0],[18.0,1.0],[18.0,8.0],[8.0,14.0],[-13.0,19.0],[-22.0,14.0],[-11.8,9.0]],"i":[[0.0,0.0],[-1.04,-1.14],[2.5,-2.5],[3.79,-1.11],[6.0,0.0],[0.0,4.0],[-2.5,0.1]],"o":[[1.54,0.14],[1.3,1.7],[-2.77,2.82],[-6.0,2.0],[-5.1,0.0],[0.0,-4.4],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.1,8.6],[-8.3,10.3],[-13.2,3.4],[-8.3,-3.5],[-3.4,3.4],[-5.1,8.6]],"i":[[0.0,0.0],[1.27,-0.04],[0.0,3.8],[-2.7,0.0],[0.0,-3.8],[1.12,-1.5]],"o":[[-0.75,1.03],[-2.7,0.0],[0.0,-3.8],[2.7,0.0],[0.02,1.87],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.44,"l":1},{"v":[[3.8,6.3],[3.2,2.9],[8.1,-4.0],[13.0,2.9],[8.1,9.8],[3.8,6.3]],"i":[[0.0,0.0],[-0.01,1.16],[-2.7,0.0],[0.0,-3.9],[2.7,0.0],[0.9,2.1]],"o":[[-0.41,-1.09],[0.0,-3.8],[2.7,0.0],[0.0,3.9],[-1.8,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.44,"l":1},{"v":[[10.1,3.0],[8.1,5.0],[6.1,3.0],[8.1,1.0],[10.1,3.0]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-6.3,3.4],[-8.3,5.4],[-10.3,3.4],[-8.3,1.4],[-6.3,3.4]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"2728":[{"v":[[-10.29,4.11],[-8.33,5.77],[3.58,8.02],[3.59,8.82],[-8.33,11.08],[-10.29,12.73],[-13.45,30.23],[-14.55,30.23],[-17.7,12.73],[-19.66,11.08],[-31.58,8.82],[-31.58,8.02],[-19.66,5.76],[-18.34,3.82],[-15.69,-10.27],[-13.45,-13.39]],"i":[[-0.19,-1.08],[-1.04,-0.2],[0.0,0.0],[0.56,-0.11],[2.9,-0.55],[0.15,-0.8],[0.0,0.0],[0.09,0.48],[0.0,0.0],[1.04,0.2],[3.16,0.6],[-0.56,0.11],[-2.9,0.55],[-0.15,0.8],[0.0,0.0],[-0.09,-0.48]],"o":[[0.15,0.81],[0.0,0.0],[0.56,0.11],[-3.16,0.6],[-1.04,0.2],[0.0,0.0],[-0.09,0.48],[0.0,0.0],[-0.15,-0.81],[-2.9,-0.55],[-0.56,-0.11],[3.16,-0.6],[1.04,-0.2],[0.0,0.0],[0.09,-0.48],[0.98,5.44]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-13.35,30.23],[-11.77,14.82],[-16.94,2.0],[-18.3,4.12],[-20.12,5.78],[-31.18,8.03],[-31.18,8.84],[-20.12,11.09],[-17.3,12.74],[-14.37,30.23]],"i":[[-0.08,0.48],[0.0,0.0],[1.3,3.41],[0.0,0.0],[0.97,-0.2],[2.93,-0.6],[-0.52,-0.11],[-2.69,-0.55],[-0.13,-0.8],[0.0,0.0]],"o":[[0.0,0.0],[-2.8,-4.62],[0.0,0.0],[-0.13,0.8],[-2.69,0.55],[-0.52,0.11],[2.93,0.6],[0.97,0.2],[0.0,0.0],[0.08,0.48]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.68,-16.7],[12.1,-15.5],[20.7,-13.87],[20.7,-13.29],[12.09,-11.66],[10.68,-10.46],[8.4,2.17],[7.61,2.17],[5.33,-10.46],[3.91,-11.66],[-4.7,-13.29],[-4.7,-13.87],[3.91,-15.5],[4.86,-16.9],[6.66,-27.08],[8.4,-29.33]],"i":[[-0.14,-0.78],[-0.75,-0.14],[0.0,0.0],[0.4,-0.08],[2.1,-0.4],[0.1,-0.58],[0.0,0.0],[0.06,0.35],[0.0,0.0],[0.75,0.14],[2.28,0.43],[-0.4,0.08],[-2.1,0.4],[-0.1,0.58],[0.0,0.0],[-0.06,-0.35]],"o":[[0.1,0.58],[0.0,0.0],[0.4,0.08],[-2.28,0.43],[-0.75,0.14],[0.0,0.0],[-0.06,0.35],[0.0,0.0],[-0.1,-0.58],[-2.1,-0.4],[-0.4,-0.08],[2.28,-0.43],[0.75,-0.14],[0.0,0.0],[0.06,-0.35],[0.71,3.93]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[8.75,2.17],[9.61,-8.96],[5.15,-18.22],[4.9,-16.69],[3.58,-15.49],[-4.41,-13.86],[-4.41,-13.28],[3.58,-11.65],[5.9,-10.46],[8.01,2.17]],"i":[[-0.06,0.35],[0.0,0.0],[0.94,2.46],[0.0,0.0],[0.7,-0.14],[2.12,-0.43],[-0.37,-0.08],[-1.95,-0.4],[-0.1,-0.58],[0.0,0.0]],"o":[[0.0,0.0],[-2.02,-3.34],[0.0,0.0],[-0.1,0.58],[-1.95,0.4],[-0.37,0.08],[2.12,0.43],[0.7,0.14],[0.0,0.0],[0.06,0.35]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[20.88,12.94],[22.05,13.89],[29.12,15.19],[29.12,15.65],[22.05,16.95],[20.88,17.9],[19.01,27.98],[18.36,27.98],[16.49,17.9],[15.32,16.95],[8.25,15.65],[8.25,15.19],[15.32,13.89],[16.1,12.77],[17.58,4.65],[19.01,2.86]],"i":[[-0.12,-0.62],[-0.62,-0.11],[0.0,0.0],[0.33,-0.06],[1.72,-0.32],[0.09,-0.46],[0.0,0.0],[0.05,0.28],[0.0,0.0],[0.62,0.11],[1.88,0.34],[-0.33,0.06],[-1.72,0.32],[-0.09,0.46],[0.0,0.0],[-0.05,-0.28]],"o":[[0.09,0.46],[0.0,0.0],[0.33,0.06],[-1.88,0.34],[-0.62,0.11],[0.0,0.0],[-0.05,0.28],[0.0,0.0],[-0.09,-0.46],[-1.72,-0.32],[-0.33,-0.06],[1.88,-0.34],[0.62,-0.11],[0.0,0.0],[0.05,-0.28],[0.58,3.14]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[19.23,27.98],[20.29,19.11],[16.73,11.72],[16.53,12.94],[15.48,13.9],[9.1,15.19],[9.1,15.66],[15.48,16.96],[16.53,17.91],[18.65,27.98]],"i":[[-0.05,0.28],[0.0,0.0],[0.75,1.97],[0.0,0.0],[0.56,-0.11],[1.69,-0.34],[-0.3,-0.06],[-1.55,-0.32],[-0.08,-0.46],[0.0,0.0]],"o":[[0.0,0.0],[-1.61,-2.66],[0.0,0.0],[-0.08,0.46],[-1.55,0.32],[-0.3,0.06],[1.69,0.34],[0.56,0.11],[0.0,0.0],[0.05,0.28]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-16.0,-4.0],[-13.86,-15.16],[-13.16,-10.98],[-10.83,2.92],[-7.31,6.12],[4.0,8.42],[-7.32,10.72],[-10.83,13.92],[-13.86,32.0],[-16.89,13.92],[-20.4,10.72],[-31.72,8.42],[-20.4,6.12],[-17.0,2.0]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.88,-0.38],[0.0,0.0],[0.0,0.0],[0.26,-1.56],[0.0,0.0],[0.0,0.0],[1.87,0.38],[0.0,0.0],[0.0,0.0],[-0.26,1.56]],"o":[[0.0,0.0],[0.0,0.0],[0.11,0.67],[0.26,1.56],[0.0,0.0],[0.0,0.0],[-1.87,0.38],[0.0,0.0],[0.0,0.0],[-0.26,-1.56],[0.0,0.0],[0.0,0.0],[1.87,-0.38],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.56,-22.55],[8.1,-30.61],[8.61,-27.59],[10.29,-17.55],[12.83,-15.24],[21.0,-13.58],[12.83,-11.92],[10.29,-9.61],[8.1,3.45],[5.92,-9.61],[3.38,-11.92],[-4.8,-13.58],[3.38,-15.24],[5.83,-18.22]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.36,-0.28],[0.0,0.0],[0.0,0.0],[0.19,-1.13],[0.0,0.0],[0.0,0.0],[1.35,0.28],[0.0,0.0],[0.0,0.0],[-0.19,1.13]],"o":[[0.0,0.0],[0.0,0.0],[0.08,0.48],[0.19,1.13],[0.0,0.0],[0.0,0.0],[-1.35,0.28],[0.0,0.0],[0.0,0.0],[-0.19,-1.13],[0.0,0.0],[0.0,0.0],[1.35,-0.28],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[17.85,8.27],[19.08,1.84],[19.48,4.24],[20.83,12.25],[22.85,14.09],[29.37,15.42],[22.85,16.75],[20.83,18.59],[19.08,29.0],[17.34,18.59],[15.31,16.75],[8.8,15.42],[15.31,14.09],[17.27,11.72]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.08,-0.22],[0.0,0.0],[0.0,0.0],[0.15,-0.9],[0.0,0.0],[0.0,0.0],[1.08,0.22],[0.0,0.0],[0.0,0.0],[-0.15,0.9]],"o":[[0.0,0.0],[0.0,0.0],[0.06,0.38],[0.15,0.9],[0.0,0.0],[0.0,0.0],[-1.08,0.22],[0.0,0.0],[0.0,0.0],[-0.15,-0.9],[0.0,0.0],[0.0,0.0],[1.08,-0.22],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F680":[{"v":[[12.46,-14.34],[14.57,-12.24],[12.46,-10.14],[10.36,-12.24]],"i":[[-1.16,0.0],[0.0,-1.16],[1.16,0.0],[0.0,1.16]],"o":[[1.16,0.0],[0.0,1.16],[-1.16,0.0],[0.0,-1.16]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-19.88,12.11],[-23.85,23.8],[-12.17,19.83],[-8.2,8.14]],"i":[[3.16,-3.16],[-0.68,-4.13],[-3.16,3.16],[0.68,4.13]],"o":[[-3.16,3.16],[4.13,0.68],[3.16,-3.16],[-4.13,-0.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-4.03,9.84],[-5.39,12.39],[-6.53,13.24],[-1.84,22.99],[0.2,21.02],[5.05,14.19],[7.8,6.56],[-4.03,9.84]],"i":[[0.0,0.0],[0.7,-0.7],[0.42,-0.23],[-0.94,-3.47],[-0.65,0.69],[-1.3,2.49],[-0.57,2.64],[4.05,-0.21]],"o":[[-0.19,0.97],[-0.34,0.34],[2.16,2.97],[0.71,-0.62],[1.91,-2.03],[1.25,-2.42],[-3.73,1.95],[0.0,0.0]],"c":true,"f":[0.3804,0.698,0.8941]},{"v":[[-21.08,-0.25],[-23.05,1.79],[-13.29,6.47],[-12.44,5.34],[-9.9,3.98],[-6.61,-7.84],[-6.6,-7.85],[-14.24,-5.1],[-21.08,-0.25]],"i":[[0.0,0.0],[0.62,-0.71],[-2.98,-2.16],[-0.33,0.33],[-0.96,0.19],[-1.96,3.72],[-0.0,0.0],[2.42,-1.25],[2.03,-1.91]],"o":[[-0.69,0.65],[3.47,0.93],[0.23,-0.41],[0.69,-0.69],[0.21,-4.05],[0.0,-0.0],[-2.64,0.57],[-2.5,1.3],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"p":[{"v":[[-1.18,-15.25],[-9.9,3.98],[-5.39,5.34],[-4.03,9.87],[15.21,1.13],[23.64,-23.71],[18.35,-24.02],[-1.18,-15.25]],"i":[[0.0,0.0],[0.36,-7.07],[-1.18,-1.18],[0.34,-1.64],[-5.25,5.24],[1.45,8.77],[1.79,-0.07],[5.32,-5.32]],"o":[[-5.23,5.25],[1.64,-0.33],[1.19,1.19],[7.08,-0.36],[6.71,-6.72],[-1.73,-0.28],[-7.17,0.29],[0.0,0.0]],"c":true},{"v":[[9.07,-15.78],[15.74,-15.78],[15.74,-15.78],[15.74,-9.12],[15.74,-9.11],[9.07,-9.12]],"i":[[-1.84,1.84],[-1.84,-1.84],[-0.0,-0.0],[1.84,-1.84],[0.0,-0.0],[1.84,1.84]],"o":[[1.84,-1.84],[0.0,0.0],[1.84,1.84],[-0.0,0.0],[-1.84,1.84],[-1.84,-1.84]],"c":true}],"f":[0.9176,0.3529,0.2784]},{"v":[[-9.46,16.04],[-12.47,18.6],[-23.91,20.25],[-23.85,23.8],[-12.17,19.82],[-9.46,16.04]],"i":[[0.0,0.0],[1.12,-0.72],[3.72,1.18],[-0.19,-1.16],[-3.16,3.16],[-0.68,1.39]],"o":[[-0.88,0.98],[-3.49,2.22],[-0.15,1.2],[4.13,0.68],[1.1,-1.11],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-9.8,2.69],[-9.86,3.97],[-5.39,5.34],[-4.03,9.87],[15.21,1.13],[19.18,-3.8],[14.83,-0.5],[-9.8,2.69]],"i":[[0.0,0.0],[0.01,-0.43],[-1.17,-1.17],[0.34,-1.64],[-5.25,5.24],[-1.15,1.77],[1.55,-0.97],[7.93,2.71]],"o":[[-0.03,0.43],[1.63,-0.32],[1.19,1.19],[7.07,-0.36],[1.49,-1.51],[-1.35,1.23],[-7.56,4.71],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-11.96,12.55],[-9.41,11.11],[-2.78,5.56],[-2.78,5.55],[1.95,-1.36],[2.06,-1.74],[-11.96,12.55]],"i":[[0.0,0.0],[-0.83,0.52],[-1.95,2.15],[0.0,0.0],[-1.26,2.49],[-0.01,0.13],[-0.83,-4.04]],"o":[[0.87,-0.44],[2.44,-1.53],[0.0,0.0],[1.88,-2.09],[0.06,-0.12],[-3.4,-0.75],[0.0,0.0]],"c":true,"f":[0.3804,0.698,0.8941]},{"p":[{"v":[[12.41,-6.51],[6.46,-12.45],[12.41,-18.39],[18.35,-12.45]],"i":[[3.28,0.0],[0.0,3.28],[-3.28,0.0],[0.0,-3.28]],"o":[[-3.28,0.0],[0.0,-3.28],[3.28,0.0],[0.0,3.28]],"c":true},{"v":[[12.41,-16.41],[8.44,-12.45],[12.41,-8.49],[16.37,-12.45]],"i":[[2.18,0.0],[0.0,-2.18],[-2.18,0.0],[0.0,2.18]],"o":[[-2.18,0.0],[0.0,2.18],[2.18,0.0],[0.0,-2.18]],"c":true}],"f":[0.0,0.0,0.0],"l":1},{"v":[[-15.35,9.06],[-19.88,12.11],[-23.85,23.8],[-12.17,19.82],[-9.11,15.29]],"i":[[0.0,0.0],[1.31,-1.3],[-0.68,-4.13],[-3.16,3.16],[-0.71,1.68]],"o":[[-1.68,0.71],[-3.16,3.16],[4.13,0.68],[1.3,-1.31],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-21.08,-0.25],[-23.05,1.79],[-13.29,6.47],[-12.44,5.34],[-9.9,3.98],[-6.61,-7.84],[-6.6,-7.85],[-14.24,-5.1],[-21.08,-0.25]],"i":[[0.0,0.0],[0.62,-0.71],[-2.98,-2.16],[-0.33,0.33],[-0.96,0.19],[-1.96,3.72],[-0.0,0.0],[2.42,-1.25],[2.03,-1.91]],"o":[[-0.69,0.65],[3.47,0.93],[0.23,-0.41],[0.69,-0.69],[0.21,-4.05],[0.0,-0.0],[-2.64,0.57],[-2.5,1.3],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-4.03,9.84],[-5.39,12.39],[-6.53,13.24],[-1.84,22.99],[0.2,21.02],[5.05,14.19],[7.8,6.56],[-4.03,9.84]],"i":[[0.0,0.0],[0.7,-0.7],[0.42,-0.23],[-0.94,-3.47],[-0.65,0.69],[-1.3,2.49],[-0.57,2.64],[4.05,-0.21]],"o":[[-0.19,0.97],[-0.34,0.34],[2.16,2.97],[0.71,-0.62],[1.91,-2.03],[1.25,-2.42],[-3.73,1.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-4.17,7.34],[-4.03,9.87],[15.21,1.13],[23.65,-23.71],[-1.18,-15.25],[-9.9,3.98],[-7.13,4.22]],"i":[[0.0,0.0],[0.11,-0.83],[-5.25,5.24],[1.45,8.77],[6.72,-6.71],[0.36,-7.07],[-0.87,-0.33]],"o":[[0.27,0.89],[7.08,-0.36],[6.71,-6.72],[-8.77,-1.44],[-5.23,5.25],[0.94,-0.19],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[1.07,-1.8],[1.07,-1.8],[-5.63,2.78],[-11.01,9.2],[-12.4,11.67]],"i":[[0.0,0.0],[0.0,0.0],[2.03,-1.82],[1.48,-2.37],[0.42,-0.84]],"o":[[0.0,0.0],[-2.42,1.22],[-2.08,1.89],[-0.5,0.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1}],"2705":[{"v":[[17.19,16.84],[-15.42,16.84],[-16.1,16.18],[-16.1,-15.5],[-15.42,-16.16],[6.09,-16.16],[7.38,-16.16],[9.39,-16.16],[16.06,-16.16],[17.19,-16.16],[17.87,-15.5],[17.87,16.18]],"i":[[0.38,0.0],[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.38,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0]],"o":[[0.0,0.0],[-0.38,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.38,0.0],[0.0,0.0],[-0.0,0.36]],"c":true,"f":[0.6941,0.8,0.2]},{"v":[[-5.34,-5.46],[-9.66,-2.94],[-1.75,11.44],[3.08,11.44],[23.76,-21.56],[21.24,-25.88],[0.01,3.37]],"i":[[2.02,2.84],[-1.86,-2.63],[-2.04,-5.13],[-0.6,2.65],[-12.47,5.83],[2.9,-1.35],[3.55,-11.89]],"o":[[-1.85,-2.61],[3.19,4.51],[0.84,2.09],[2.83,-12.6],[2.91,-1.36],[-11.43,5.35],[-1.56,-3.05]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[17.0,-13.36],[17.0,17.12],[16.34,17.78],[-15.34,17.78],[-16.0,17.12],[-16.0,-14.56],[-15.34,-15.22],[4.74,-15.22],[5.31,-15.22]],"i":[[0.0,0.0],[0.0,0.0],[0.36,0.0],[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.36,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.36,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.34,-5.46],[-9.66,-2.94],[-1.75,11.44],[3.08,11.44],[23.76,-21.56],[21.24,-25.88],[0.01,3.37]],"i":[[2.02,2.84],[-1.86,-2.63],[-2.04,-5.13],[-0.6,2.65],[-12.47,5.83],[2.9,-1.35],[3.55,-11.89]],"o":[[-1.85,-2.61],[3.19,4.51],[0.84,2.09],[2.83,-12.6],[2.91,-1.36],[-11.43,5.35],[-1.56,-3.05]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"26A0":[{"v":[[-3.48,-22.99],[0.0,-25.02],[3.48,-22.99],[24.45,18.94],[25.0,20.95],[20.97,24.98],[-20.97,25.0],[-25.0,20.97],[-24.45,18.96],[-3.48,-22.99]],"i":[[0.0,0.0],[-1.49,0.0],[-0.7,-1.2],[0.0,0.0],[0.0,-0.73],[2.23,0.0],[0.0,0.0],[0.0,2.23],[-0.34,0.59],[0.0,0.0]],"o":[[0.7,-1.2],[1.49,0.0],[0.0,0.0],[0.34,0.59],[0.0,2.23],[0.0,0.0],[-2.23,0.0],[0.0,-0.74],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[1.61,11.27],[0.0,12.88],[-1.61,11.27],[-1.61,-12.11],[0.0,-13.72],[1.61,-12.11]],"i":[[0.0,0.0],[0.89,0.0],[0.0,0.89],[0.0,0.0],[-0.89,0.0],[0.0,-0.89]],"o":[[0.0,0.89],[-0.89,0.0],[0.0,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,16.92],[1.61,18.53],[0.0,20.14],[-1.61,18.53]],"i":[[-0.89,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.89]],"o":[[0.89,0.0],[0.0,0.89],[-0.89,0.0],[0.0,-0.89]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-3.48,-22.99],[0.0,-25.02],[3.48,-22.99],[24.45,18.94],[25.0,20.95],[20.97,24.98],[-20.97,25.0],[-25.0,20.97],[-24.45,18.96],[-3.48,-22.99]],"i":[[0.0,0.0],[-1.49,0.0],[-0.7,-1.2],[0.0,0.0],[0.0,-0.73],[2.23,0.0],[0.0,0.0],[0.0,2.23],[-0.34,0.59],[0.0,0.0]],"o":[[0.7,-1.2],[1.49,0.0],[0.0,0.0],[0.34,0.59],[0.0,2.23],[0.0,0.0],[-2.23,0.0],[0.0,-0.74],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.61,11.27],[0.0,12.88],[-1.61,11.27],[-1.61,-12.11],[0.0,-13.72],[1.61,-12.11]],"i":[[0.0,0.0],[0.89,0.0],[0.0,0.89],[0.0,0.0],[-0.89,0.0],[0.0,-0.89]],"o":[[0.0,0.89],[-0.89,0.0],[0.0,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,16.92],[1.61,18.53],[0.0,20.14],[-1.61,18.53]],"i":[[-0.89,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.89]],"o":[[0.89,0.0],[0.0,0.89],[-0.89,0.0],[0.0,-0.89]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F389":[{"v":[[-9.82,-15.82],[2.75,-3.25],[15.32,9.32],[-6.21,18.28],[-27.74,27.24],[-18.78,5.71]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[4.0,-1.0],[-10.31,-15.33],[-19.61,6.54],[-28.91,28.41]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-20.78,9.28],[-9.71,20.35],[-15.25,22.6],[-23.04,14.8]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-18.66,19.25],[-15.25,22.6],[-9.71,20.35],[-14.52,15.55]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-15.2,-3.84],[-8.5,2.86],[3.2,14.56],[-3.07,17.42],[-11.24,9.25],[-17.85,2.64]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-9.46,11.03],[-3.07,17.42],[3.2,14.56],[-4.64,6.72]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-5.7,-23.51],[-3.7,-21.54],[-5.7,-19.57],[-7.7,-21.54]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.5373,0.4039,0.6667]},{"v":[[24.3,-19.51],[26.3,-17.54],[24.3,-15.57],[22.3,-17.54]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[21.3,1.49],[23.3,3.46],[21.3,5.43],[19.3,3.46]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[14.66,9.64],[14.83,9.81],[-7.04,19.11],[-28.91,28.41],[-19.61,6.54],[-10.31,-15.33]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.2,-15.22],[2.26,-2.76],[14.66,9.64]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.31,-15.33],[-10.2,-15.22]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.49,-28.63],[10.98,-27.16],[6.74,-21.2]],"i":[[0.0,0.0],[-0.09,-0.53],[2.79,-0.54]],"o":[[0.23,0.45],[0.45,2.75],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.93,-21.22],[5.42,-20.86],[2.61,-14.11]],"i":[[0.0,0.0],[0.5,-0.21],[-1.02,-2.66]],"o":[[-0.5,0.04],[-2.57,1.07],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[25.79,-9.28],[25.25,-7.83],[18.21,-5.85]],"i":[[0.0,0.0],[0.26,-0.47],[2.51,1.33]],"o":[[-0.1,0.5],[-1.37,2.42],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[18.37,-5.74],[16.97,-6.41],[10.55,-2.91]],"i":[[0.0,0.0],[0.52,0.15],[0.87,-2.71]],"o":[[-0.42,-0.29],[-2.67,-0.78],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}]};

    // =========================================================================
    // 3. EMOJI CATALOG & DISK / BROWSER DATABASE LOADER
    // =========================================================================
    var EMOJI_SOURCES = [
        { id: "openmoji_color", label: "1. OpenMoji Color (Handcrafted + Outlines)", index: 1 },
        { id: "twemoji_color",  label: "2. Twemoji Flat Color (Modern Flat Shapes)", index: 2 },
        { id: "openmoji_flat",   label: "3. OpenMoji Flat (Color Only, No Outlines)", index: 3 },
        { id: "openmoji_black",  label: "4. OpenMoji Black (Line Art / Wireframe)",    index: 4 }
    ];

    var emojiCatalog = [];
    var emojiByHex = {};
    var emojiByChar = {};
    var emojiByInt = {};
    var emojiByIndex = {};
    var wikiEmoticonMap = {};
    var wikiEntries = [];

    var shapeDatabases = {
        openmoji_color: null,
        twemoji_color: null,
        openmoji_black: null
    };

    function getEmojisFolder() {
        if (typeof File === "undefined" || typeof Folder === "undefined") return null;
        try {
            var scriptFile = null;
            if (typeof $.fileName !== "undefined" && $.fileName) {
                scriptFile = new File($.fileName);
            }
            if (scriptFile && scriptFile.exists) {
                var candFolder = new Folder(scriptFile.parent.fsName + "/emojis");
                if (candFolder.exists) return candFolder;
            }
            var rootFolder = new Folder("/home/antigravity/work2survive/AE-replace-color-emojis/emojis");
            if (rootFolder.exists) return rootFolder;
            var omFolder = new Folder("/home/antigravity/work2survive/AE_Get_Emojis/emojis");
            if (omFolder.exists) return omFolder;
        } catch (eF) {}
        return null;
    }

    function loadJSONFromEmojisSubfolder(filename) {
        // 1. Browser / AE_JS_builder simulator environment: synchronous XHR
        if (typeof XMLHttpRequest !== "undefined") {
            var candidateUrls = [
                "jsx/emojis/" + filename,
                "emojis/" + filename,
                "https://raw.githubusercontent.com/work2survive/AE-replace-color-emojis/main/emojis/" + filename,
                "https://raw.githubusercontent.com/work2survive/AE_Get_Emojis/main/emojis/" + filename
            ];
            for (var u = 0; u < candidateUrls.length; u++) {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", candidateUrls[u], false);
                    xhr.send(null);
                    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                        var txt = trimStr(xhr.responseText);
                        if (txt.charAt(0) === "{" || txt.charAt(0) === "[") {
                            return JSONPolyfill.parse(txt);
                        }
                    }
                } catch (eXhr) {}
            }
        }

        // 2. Desktop Adobe After Effects ExtendScript: read from /emojis/ folder on disk
        if (typeof File !== "undefined") {
            try {
                var folder = getEmojisFolder();
                if (folder && folder.exists) {
                    var f = new File(folder.fsName + "/" + filename);
                    if (f.exists) {
                        f.encoding = "UTF-8";
                        if (f.open("r")) {
                            var content = f.read();
                            f.close();
                            if (content && content.length > 2) {
                                return JSONPolyfill.parse(content);
                            }
                        }
                    }
                }
            } catch (eFile) {}
        }
        return null;
    }

    function rebuildLookupTables(idxData, wikiData) {
        emojiCatalog = (idxData && idxData.emojis && idxData.emojis.length)
            ? idxData.emojis
            : FALLBACK_INDEX_DATA.emojis;

        emojiByHex = {};
        emojiByChar = {};
        emojiByInt = {};
        emojiByIndex = {};

        for (var i = 0; i < emojiCatalog.length; i++) {
            var item = emojiCatalog[i];
            item.index = i + 1;
            var hc = String(item.hexcode || "").toUpperCase();
            if (!item.unicodeInt) {
                item.unicodeInt = unicodeHexToInt(hc);
            }
            if (!item.unicode) {
                item.unicode = "U+" + hc;
            }
            if (!item.emoji) {
                item.emoji = codePointToGlyph(item.unicodeInt);
            }
            emojiByHex[hc] = item;
            if (item.emoji) {
                emojiByChar[item.emoji] = item;
            }
            emojiByInt[item.unicodeInt] = item;
            emojiByIndex[item.index] = item;
        }

        var wData = wikiData || FALLBACK_WIKI_DATA;
        wikiEmoticonMap = {};
        wikiEntries = (wData && wData.entries) ? wData.entries : [];

        if (wData && wData.lookup) {
            for (var k in wData.lookup) {
                if (wData.lookup.hasOwnProperty(k)) {
                    var hexVal = String(wData.lookup[k]).toUpperCase();
                    wikiEmoticonMap[k] = hexVal;
                    wikiEmoticonMap[k.toLowerCase()] = hexVal;
                }
            }
        }
        for (var w = 0; w < wikiEntries.length; w++) {
            var we = wikiEntries[w];
            var whc = String(we.hexcode || "").toUpperCase();
            var emos = we.emoticons || [];
            for (var ei = 0; ei < emos.length; ei++) {
                wikiEmoticonMap[emos[ei]] = whc;
                wikiEmoticonMap[emos[ei].toLowerCase()] = whc;
            }
        }
    }

    function loadAllEmojiDatabases() {
        var idxData = loadJSONFromEmojisSubfolder("emoji_index.json") || FALLBACK_INDEX_DATA;
        var wikiData = loadJSONFromEmojisSubfolder("wikipedia_emoticons.json") || FALLBACK_WIKI_DATA;
        rebuildLookupTables(idxData, wikiData);

        var omColor = loadJSONFromEmojisSubfolder("openmoji_color.json");
        shapeDatabases.openmoji_color = omColor || FALLBACK_SHAPES_DATA;

        var twColor = loadJSONFromEmojisSubfolder("twemoji_color.json");
        shapeDatabases.twemoji_color = twColor || shapeDatabases.openmoji_color;

        var omBlack = loadJSONFromEmojisSubfolder("openmoji_black.json");
        shapeDatabases.openmoji_black = omBlack || shapeDatabases.openmoji_color;
    }

    loadAllEmojiDatabases();

    function getShapesForEmoji(hexcode, sourceId) {
        var hc = String(hexcode || "").toUpperCase();
        var shapes = null;

        if (sourceId === "twemoji_color") {
            if (shapeDatabases.twemoji_color && shapeDatabases.twemoji_color[hc]) {
                shapes = shapeDatabases.twemoji_color[hc];
            }
        } else if (sourceId === "openmoji_black") {
            if (shapeDatabases.openmoji_black && shapeDatabases.openmoji_black[hc]) {
                shapes = shapeDatabases.openmoji_black[hc];
            }
        }

        if (!shapes && shapeDatabases.openmoji_color && shapeDatabases.openmoji_color[hc]) {
            shapes = shapeDatabases.openmoji_color[hc];
        }

        if (!shapes && FALLBACK_SHAPES_DATA[hc]) {
            shapes = FALLBACK_SHAPES_DATA[hc];
        }

        // If shapes not found, fall back to smiling face (1F642 or 1F603)
        if (!shapes || shapes.length === 0) {
            shapes = (shapeDatabases.openmoji_color && shapeDatabases.openmoji_color["1F642"])
                || FALLBACK_SHAPES_DATA["1F642"]
                || FALLBACK_SHAPES_DATA["1F603"]
                || [];
        }

        if (sourceId === "openmoji_flat") {
            var filtered = [];
            for (var si = 0; si < shapes.length; si++) {
                if (!shapes[si].l) filtered.push(shapes[si]);
            }
            if (filtered.length > 0) return filtered;
        }

        return shapes;
    }

    // =========================================================================
    // 4. UNICODE EMOJI RECOGNITION & PARSING ENGINE
    // =========================================================================
    /**
     * Scans a line or text string and returns all matched emojis.
     * Supports:
     * - UTF-16 surrogate pairs (U+1F000 - U+1FAFF)
     * - BMP emojis (U+2600 - U+27BF, U+2B00 - U+2BFF, etc.)
     * - Variation Selector 16 (\uFE0F)
     * - Wikipedia text emoticons (:D, :), <3, etc.) and shortcodes (:fire:, :100:)
     */
    function findEmojisInString(str, detectEmoticons) {
        var matches = [];
        if (!str || str.length === 0) return matches;

        var i = 0;
        while (i < str.length) {
            var code = str.charCodeAt(i);

            // 1. Surrogate pair (Code points > 0xFFFF, e.g. 1F603, 1F680, 1F525)
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
                var nextCode = str.charCodeAt(i + 1);
                if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                    var cp = ((code - 0xD800) * 0x400) + (nextCode - 0xDC00) + 0x10000;
                    var hex = cp.toString(16).toUpperCase();
                    var matchLen = 2;

                    // Check for optional Variation Selector-16 (U+FE0F)
                    if (i + 2 < str.length && str.charCodeAt(i + 2) === 0xFE0F) {
                        matchLen = 3;
                    }

                    var matchedChar = str.substr(i, matchLen);
                    var entry = emojiByHex[hex] || emojiByChar[matchedChar.substr(0, 2)];
                    if (!entry) {
                        // Create dynamic entry for unindexed Unicode emoji
                        entry = {
                            hexcode: hex,
                            unicode: "U+" + hex,
                            unicodeInt: cp,
                            emoji: matchedChar.substr(0, 2),
                            name: "Emoji U+" + hex,
                            index: 0
                        };
                    }

                    matches.push({
                        start: i,
                        length: matchLen,
                        hexcode: hex,
                        char: matchedChar,
                        entry: entry,
                        isEmoticon: false
                    });

                    i += matchLen;
                    continue;
                }
            }

            // 2. BMP emoji (e.g. U+2764 red heart, U+2728 sparkles, U+2705 check mark, U+26A0 warning)
            var isBmpEmoji = false;
            if ((code >= 0x2600 && code <= 0x27BF) ||
                (code >= 0x2B00 && code <= 0x2BFF) ||
                (code >= 0x2300 && code <= 0x23FF) ||
                code === 0x203C || code === 0x2049 || code === 0x2122 || code === 0x2139 ||
                code === 0x3030 || code === 0x303D || code === 0x3297 || code === 0x3299) {
                isBmpEmoji = true;
            }

            if (isBmpEmoji) {
                var bmpHex = code.toString(16).toUpperCase();
                var bmpLen = 1;
                if (i + 1 < str.length && str.charCodeAt(i + 1) === 0xFE0F) {
                    bmpLen = 2;
                }
                var bmpChar = str.substr(i, bmpLen);
                var bmpEntry = emojiByHex[bmpHex] || emojiByChar[str.substr(i, 1)];
                if (!bmpEntry) {
                    bmpEntry = {
                        hexcode: bmpHex,
                        unicode: "U+" + bmpHex,
                        unicodeInt: code,
                        emoji: bmpChar.substr(0, 1),
                        name: "Emoji U+" + bmpHex,
                        index: 0
                    };
                }

                matches.push({
                    start: i,
                    length: bmpLen,
                    hexcode: bmpHex,
                    char: bmpChar,
                    entry: bmpEntry,
                    isEmoticon: false
                });

                i += bmpLen;
                continue;
            }

            // 3. Emoticons & Shortcodes (if enabled)
            if (detectEmoticons) {
                var matchedEmo = null;

                // Check :shortcode: format
                if (str.charAt(i) === ":") {
                    var endColon = str.indexOf(":", i + 1);
                    if (endColon !== -1 && endColon - i <= 24) {
                        var sc = str.substring(i, endColon + 1);
                        if (wikiEmoticonMap[sc]) {
                            matchedEmo = { text: sc, hex: wikiEmoticonMap[sc] };
                        }
                    }
                }

                // Check text emoticons (e.g. :D, :), <3, etc.)
                if (!matchedEmo) {
                    for (var emoText in wikiEmoticonMap) {
                        if (wikiEmoticonMap.hasOwnProperty(emoText)) {
                            if (str.substr(i, emoText.length) === emoText) {
                                if (!matchedEmo || emoText.length > matchedEmo.text.length) {
                                    matchedEmo = { text: emoText, hex: wikiEmoticonMap[emoText] };
                                }
                            }
                        }
                    }
                }

                if (matchedEmo) {
                    var emoHex = matchedEmo.hex.toUpperCase();
                    var emoEntry = emojiByHex[emoHex] || {
                        hexcode: emoHex,
                        unicode: "U+" + emoHex,
                        unicodeInt: unicodeHexToInt(emoHex),
                        emoji: codePointToGlyph(unicodeHexToInt(emoHex)),
                        name: "Emoticon " + matchedEmo.text,
                        index: 0
                    };

                    matches.push({
                        start: i,
                        length: matchedEmo.text.length,
                        hexcode: emoHex,
                        char: matchedEmo.text,
                        entry: emoEntry,
                        isEmoticon: true
                    });

                    i += matchedEmo.text.length;
                    continue;
                }
            }

            i++;
        }

        return matches;
    }

    // =========================================================================
    // 5. TEXT LAYER UTILITIES & ZERO-SHIFT ANCHOR POINT ALIGNMENT
    // =========================================================================
    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            if (layer.matchName === "ADBE Text Layer") return true;
        } catch (eM) {}
        try {
            if (typeof layer.property === "function") {
                if (layer.property("ADBE Text Properties") || layer.property("Source Text") || layer.property("ADBE Text Document")) {
                    return true;
                }
            }
        } catch (eP) {}
        return false;
    }

    function getTextDocument(layer) {
        if (!layer) return null;
        try {
            var st = layer.property("Source Text")
                || layer.property("ADBE Text Properties").property("ADBE Text Document")
                || layer.sourceText;
            if (st && st.value) return st.value;
        } catch (e1) {}
        try {
            if (layer.text && layer.text.sourceText && layer.text.sourceText.value) {
                return layer.text.sourceText.value;
            }
        } catch (e2) {}
        return null;
    }

    function getTextLayerString(layer) {
        var doc = getTextDocument(layer);
        if (doc && typeof doc.text === "string") return doc.text;
        try {
            if (layer.name) return layer.name;
        } catch (e) {}
        return "";
    }

    function getSourceRect(layer, compTime) {
        var t = (typeof compTime === "number") ? compTime : 0;
        try {
            if (layer && typeof layer.sourceRectAtTime === "function") {
                var r = layer.sourceRectAtTime(t, false);
                if (r && typeof r.width === "number") return r;
            }
        } catch (eSR) {}
        return { left: 0, top: 0, width: 300, height: 60 };
    }

    function getSelectedTextLayer(comp) {
        if (!comp) return null;
        try {
            var sel = comp.selectedLayers;
            if (sel && sel.length > 0) {
                for (var i = 0; i < sel.length; i++) {
                    var l = sel[i];
                    if (isTextLayer(l)) return l;
                    if (l && l.parent && isTextLayer(l.parent)) return l.parent;
                }
            }
        } catch (eSel) {}
        return null;
    }

    function getJustificationName(textDoc, textLayer) {
        if (textDoc && typeof textDoc.justification !== "undefined") {
            var j = textDoc.justification;
            if (typeof ParagraphJustification !== "undefined") {
                if (j === ParagraphJustification.CENTER_JUSTIFY) return "center";
                if (j === ParagraphJustification.RIGHT_JUSTIFY) return "right";
                if (j === ParagraphJustification.LEFT_JUSTIFY) return "left";
            }
            if (j === 7413 || j === "center" || j === "CENTER") return "center";
            if (j === 7414 || j === "right" || j === "RIGHT") return "right";
            return "left";
        }
        return "left";
    }

    function measureTextExact(str, fontSize, fontName) {
        if (!str || str.length === 0) return 0;
        var fs = fontSize || 34;
        return str.length * (fs * 0.55);
    }

    function createMeasureHelper(comp, props) {
        var measureLayer = null;
        var measureProp = null;
        var pipeRight = 0;
        var sampleTime = 0;

        if (comp && typeof comp.layers.addText === "function") {
            try {
                measureLayer = comp.layers.addText("");
                measureLayer.enabled = true;
                measureLayer.transform.position.setValue([-9999, -9999, 0]);
                measureLayer.startTime = 0;
                measureLayer.inPoint = 0;
                measureLayer.outPoint = (comp.duration && comp.duration > 0) ? comp.duration : 1000;
                sampleTime = measureLayer.inPoint;

                try { measureProp = measureLayer.property("Source Text"); } catch (eP1) {}
                if (!measureProp) {
                    try { measureProp = measureLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eP2) {}
                }
                if (!measureProp && measureLayer.sourceText) measureProp = measureLayer.sourceText;

                if (measureProp) {
                    var doc = measureProp.value;
                    if (doc) {
                        doc.fontSize = props.fontSize || 34;
                        if (props.font) {
                            try { doc.font = props.font; } catch (eF) {}
                        }
                        doc.tracking = props.tracking || 0;
                        doc.applyFill = true;
                        doc.fillColor = [1, 1, 1];
                        try { doc.boxText = false; } catch (eBT) {}
                        try {
                            if (typeof ParagraphJustification !== "undefined") {
                                doc.justification = ParagraphJustification.LEFT_JUSTIFY;
                            } else {
                                doc.justification = 7412;
                            }
                        } catch (eJ) {}
                        measureProp.setValue(doc);
                    }

                    // Measure delimiter anchor "|"
                    try {
                        var dP = measureProp.value;
                        if (dP) { dP.text = "|"; measureProp.setValue(dP); }
                        else { measureProp.setValue("|"); }
                        var rP = measureLayer.sourceRectAtTime(sampleTime, false);
                        if (rP && typeof rP.width === "number") {
                            pipeRight = rP.left + rP.width;
                        }
                    } catch (ePipe) {}
                }
            } catch (eM) {
                measureLayer = null;
                measureProp = null;
            }
        }

        function measureRect(str) {
            if (!str || str.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
            if (measureLayer && measureProp) {
                try {
                    var d = measureProp.value;
                    if (d) { d.text = str; measureProp.setValue(d); }
                    else { measureProp.setValue(str); }
                    var r = measureLayer.sourceRectAtTime(sampleTime, false);
                    if (r && typeof r.width === "number" && r.width >= 0) {
                        return { left: r.left, top: r.top, width: r.width, height: r.height };
                    }
                } catch (eR) {}
            }
            var w = measureTextExact(str, props.fontSize, props.font);
            return { left: 0, top: 0, width: w, height: props.fontSize };
        }

        function measurePrefixAdvance(prefix) {
            if (!prefix || prefix.length === 0) return 0;
            if (measureLayer && measureProp && pipeRight > 0) {
                try {
                    var rPrePipe = measureRect(prefix + "|");
                    return Math.max(0, (rPrePipe.left + rPrePipe.width) - pipeRight);
                } catch (eAdv) {}
            }
            return measureTextExact(prefix, props.fontSize, props.font);
        }

        function cleanup() {
            if (measureLayer) {
                try { measureLayer.remove(); } catch (eClean) {}
                measureLayer = null;
                measureProp = null;
            }
        }

        return {
            measureRect: measureRect,
            measurePrefixAdvance: measurePrefixAdvance,
            cleanup: cleanup
        };
    }

    function getTextBoxProperties(comp, layer) {
        if (!layer || !isTextLayer(layer)) return null;
        var textDoc = getTextDocument(layer);
        if (!textDoc) return null;

        var sRect = getSourceRect(layer);
        var isBox = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var boxPos = [0, 0];

        try {
            if (textDoc.boxText && textDoc.boxTextSize) {
                isBox = true;
                boxWidth = textDoc.boxTextSize[0];
                boxHeight = textDoc.boxTextSize[1];
                if (textDoc.boxTextPos) boxPos = textDoc.boxTextPos;
            }
        } catch (eB) {}

        if (boxWidth <= 0 && sRect && sRect.width > 0) boxWidth = sRect.width;
        if (boxHeight <= 0 && sRect && sRect.height > 0) boxHeight = sRect.height;

        var fullText = String(textDoc.text || "");
        var paragraphs = fullText.split(/\r\n|\r|\n/);
        var lines = [];

        // Build visual line wrapping
        for (var p = 0; p < paragraphs.length; p++) {
            var para = paragraphs[p];
            if (!isBox || boxWidth <= 0) {
                lines.push(para);
            } else {
                var pWords = para.match(/\S+/g) || [];
                if (pWords.length === 0) {
                    lines.push("");
                    continue;
                }
                var curLine = pWords[0];
                for (var pw = 1; pw < pWords.length; pw++) {
                    var testLine = curLine + " " + pWords[pw];
                    var testW = measureTextExact(testLine, textDoc.fontSize || 34, textDoc.font);
                    if (testW > boxWidth && curLine.length > 0) {
                        lines.push(curLine);
                        curLine = pWords[pw];
                    } else {
                        curLine = testLine;
                    }
                }
                lines.push(curLine);
            }
        }

        return {
            textDoc: textDoc,
            fullText: fullText,
            fontSize: textDoc.fontSize || 34,
            font: textDoc.font || "Arial",
            leading: textDoc.leading || ((textDoc.fontSize || 34) * 1.2),
            tracking: textDoc.tracking || 0,
            fillColor: textDoc.fillColor || [1, 1, 1],
            justification: getJustificationName(textDoc, layer),
            isBox: isBox,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            boxPos: boxPos,
            sRect: sRect,
            metrics: {
                lines: lines
            }
        };
    }

    function alignAnchorPointToJustification(targetLayer, props) {
        if (!targetLayer || !props) return;
        try {
            var just = props.justification || "left";
            var xMode = (just === "center") ? "Center" : ((just === "right") ? "Right" : "Left");
            var bounds = props.isBox
                ? { left: props.boxPos[0], top: props.boxPos[1], width: props.boxWidth, height: props.boxHeight }
                : props.sRect;

            var targetAnchorX = bounds.left;
            if (xMode === "Center") targetAnchorX = bounds.left + (bounds.width / 2);
            else if (xMode === "Right") targetAnchorX = bounds.left + bounds.width;

            var targetAnchorY = bounds.top;

            var tr = targetLayer.transform;
            var curAnchor = tr.anchorPoint.value;
            var curPos = tr.position.value;

            var dx = targetAnchorX - curAnchor[0];
            var dy = targetAnchorY - curAnchor[1];

            tr.anchorPoint.setValue([targetAnchorX, targetAnchorY, curAnchor[2] || 0]);
            tr.position.setValue([curPos[0] + dx, curPos[1] + dy, curPos[2] || 0]);
        } catch (eAlign) {}
    }

    function applyTextDocCopy(targetLayer, origDoc, textContent, customFillColor) {
        if (!targetLayer || !origDoc) return;
        try {
            var prop = targetLayer.property("Source Text")
                || targetLayer.property("ADBE Text Properties").property("ADBE Text Document")
                || targetLayer.sourceText;
            if (!prop) return;
            var d = prop.value || origDoc;
            d.text = textContent;
            d.fontSize = origDoc.fontSize || 34;
            if (origDoc.font) {
                try { d.font = origDoc.font; } catch (eF) {}
            }
            d.leading = origDoc.leading || (d.fontSize * 1.2);
            d.tracking = origDoc.tracking || 0;
            d.applyFill = true;
            d.fillColor = customFillColor || origDoc.fillColor || [1, 1, 1];
            try { d.boxText = false; } catch (eBT) {}
            prop.setValue(d);
        } catch (eApply) {}
    }

    function markOriginalAsGuideline(layer) {
        if (!layer) return;
        try {
            layer.guideLayer = true;
            layer.enabled = false;
        } catch (eG) {}
    }

    // =========================================================================
    // 6. VECTOR SHAPE POPULATION ENGINE (Cubic Bézier Paths, Fills & Strokes)
    // =========================================================================
    function clearRootVectorContents(rootVectors) {
        if (!rootVectors) return;
        try {
            var num = rootVectors.numProperties;
            for (var i = num; i >= 1; i--) {
                try {
                    rootVectors.property(i).remove();
                } catch (eSub) {}
            }
        } catch (eRoot) {}
    }

    function ensureEffectSlider(fxGroup, name, val) {
        try {
            var p = fxGroup.property(name);
            if (!p) {
                p = fxGroup.addProperty("ADBE Slider Control");
                p.name = name;
            }
            if (p && p.property(1)) {
                p.property(1).setValue(val);
            }
            return p;
        } catch (e) { return null; }
    }

    function ensureEffectCheckbox(fxGroup, name, val) {
        try {
            var p = fxGroup.property(name);
            if (!p) {
                p = fxGroup.addProperty("ADBE Checkbox Control");
                p.name = name;
            }
            if (p && p.property(1)) {
                p.property(1).setValue(val ? 1 : 0);
            }
            return p;
        } catch (e) { return null; }
    }

    function buildVectorGroupForEmoji(masterContents, entry, sourceId, sizePx, posX, posY, outlinePct, showOutlines) {
        var shapes = getShapesForEmoji(entry.hexcode, sourceId);
        var inBrowser = isBrowserSim();

        var emoGrp = masterContents.addProperty("ADBE Vector Group");
        emoGrp.name = "Emoji " + entry.emoji + " [" + entry.unicode + "]";
        var emoContents = emoGrp.property("ADBE Vectors Group") || emoGrp.property("Contents");

        // Rig Master Vector Group Transform
        var emoTr = emoGrp.property("ADBE Vector Transform Group");
        if (emoTr) {
            emoTr.property("ADBE Vector Anchor").setValue([0, 0]);
            emoTr.property("ADBE Vector Position").setValue([posX, posY]);
            var scalePct = Math.round((sizePx / 72.0) * 10000) / 100;
            emoTr.property("ADBE Vector Scale").setValue([scalePct, scalePct]);

            try {
                emoTr.property("ADBE Vector Position").expression = [
                    'var ox = 0, oy = 0;',
                    'try { ox = thisLayer.effect("Offset X")(1).value; } catch(e1) {}',
                    'try { oy = thisLayer.effect("Offset Y")(1).value; } catch(e2) {}',
                    '[' + posX.toFixed(2) + ' + ox, ' + posY.toFixed(2) + ' + oy];'
                ].join('\n');
            } catch (ePosExpr) {}

            try {
                emoTr.property("ADBE Vector Scale").expression = [
                    'try {',
                    '  var sz = thisLayer.effect("Emoji Size (px)")(1).value;',
                    '  var mult = thisLayer.effect("Emoji Size Multiplier %")(1).value / 100.0;',
                    '  var s = ((sz * mult) / 72.0) * 100.0;',
                    '  [s, s];',
                    '} catch(e) { value; }'
                ].join('\n');
            } catch (eScExpr) {}
        }

        var startIdx = inBrowser ? 0 : (shapes.length - 1);
        var endIdx = inBrowser ? shapes.length : -1;
        var step = inBrowser ? 1 : -1;

        for (var idx = startIdx; idx !== endIdx; idx += step) {
            var item = shapes[idx];
            var isLine = Boolean(item.l) && (sourceId !== "openmoji_black");

            var partGrp = emoContents.addProperty("ADBE Vector Group");
            partGrp.name = (item.l ? "Outline_" : "Color_") + (idx + 1);
            var partVecs = partGrp.property("ADBE Vectors Group") || partGrp.property("Contents") || partGrp;

            var subpaths = item.p ? item.p : [item];
            for (var spIdx = 0; spIdx < subpaths.length; spIdx++) {
                var sp = subpaths[spIdx];
                if (!sp.v || sp.v.length < 2) continue;
                var pathGrp = partVecs.addProperty("ADBE Vector Shape - Group");
                pathGrp.name = "Path_" + (spIdx + 1);
                var myShape = new Shape();
                myShape.vertices = sp.v;
                myShape.inTangents = sp.i || [];
                myShape.outTangents = sp.o || [];
                myShape.closed = Boolean(sp.c);
                pathGrp.property("ADBE Vector Shape").setValue(myShape);
            }

            if (item.f) {
                var fillProp = partVecs.addProperty("ADBE Vector Graphic - Fill");
                fillProp.name = "Fill";
                fillProp.property("ADBE Vector Fill Color").setValue(item.f);
                var fOp = (typeof item.fo === "number") ? item.fo : 100;
                fillProp.property("ADBE Vector Fill Opacity").setValue(fOp);
            }

            if (item.s && item.sw > 0) {
                var strokeProp = partVecs.addProperty("ADBE Vector Graphic - Stroke");
                strokeProp.name = "Stroke";
                strokeProp.property("ADBE Vector Stroke Color").setValue(item.s);
                var baseSw = item.sw;
                var effectiveSw = isLine ? (baseSw * (outlinePct / 100.0)) : baseSw;
                strokeProp.property("ADBE Vector Stroke Width").setValue(effectiveSw);
                var sOp = (typeof item.so === "number") ? item.so : 100;
                strokeProp.property("ADBE Vector Stroke Opacity").setValue(sOp);

                if (isLine) {
                    try {
                        strokeProp.property("ADBE Vector Stroke Width").expression =
                            "try { value * (thisLayer.effect('Outline Width %')(1).value / 100); } catch(e) { value; }";
                    } catch (eSwExpr) {}
                }
            }

            if (isLine) {
                var partTr = partGrp.property("ADBE Vector Transform Group");
                if (partTr && partTr.property("ADBE Vector Opacity")) {
                    partTr.property("ADBE Vector Opacity").setValue(showOutlines ? 100 : 0);
                    try {
                        partTr.property("ADBE Vector Opacity").expression =
                            "try { (thisLayer.effect('Show Outlines')(1).value > 0) ? 100 : 0; } catch(e) { value; }";
                    } catch (eOpExpr) {}
                }
            }
        }

        return emoGrp;
    }

    // =========================================================================
    // 7. CALCULATION METHOD (INTACT TEXT BOX ENGINE)
    // =========================================================================
    function buildCalculationEmojiRig(comp, origLayer, options) {
        if (!comp || !origLayer || !isTextLayer(origLayer)) return null;

        var props = getTextBoxProperties(comp, origLayer);
        if (!props || !props.metrics) return null;

        alignAnchorPointToJustification(origLayer, props);

        var sourceId = options.sourceId || "openmoji_color";
        var sizeMult = (typeof options.sizeMultiplier === "number") ? options.sizeMultiplier : 100;
        var outlinePct = (typeof options.outlineWidth === "number") ? options.outlineWidth : 100;
        var showOutlines = (options.showOutlines !== false);
        var offX = (typeof options.offsetX === "number") ? options.offsetX : 0;
        var offY = (typeof options.offsetY === "number") ? options.offsetY : 0;
        var detectEmoticons = Boolean(options.detectEmoticons);
        var layerMode = options.layerMode || "single"; // "single" or "separate"

        var lines = props.metrics.lines;
        var lineStep = props.leading || (props.fontSize * 1.2);
        var just = props.justification || "left";

        var measurer = createMeasureHelper(comp, props);

        // Determine first line baseline relative to original text layer local origin:
        var rFirst = measurer.measureRect(lines.length > 0 ? lines[0] : "A");
        var ascender = Math.abs(rFirst.top) || (props.fontSize * 0.78);
        var firstBaselineY = (props.isBox ? props.boxPos[1] : props.sRect.top) + ascender;

        var matchedEmojis = [];
        var createdLayers = [];

        try {
            // 1. Calculate geometric coordinates for emojis across visual lines
            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (trimStr(lineStr).length === 0) continue;

                var lineW = measurer.measureRect(lineStr).width;
                var lineBaselineY = firstBaselineY + (vl * lineStep);

                var lineLeftX = 0;
                if (props.isBox) {
                    if (just === "center") lineLeftX = props.boxPos[0] + (props.boxWidth - lineW) / 2;
                    else if (just === "right") lineLeftX = props.boxPos[0] + props.boxWidth - lineW;
                    else lineLeftX = props.boxPos[0];
                } else {
                    if (just === "center") lineLeftX = -lineW / 2;
                    else if (just === "right") lineLeftX = -lineW;
                    else lineLeftX = 0;
                }

                var lineMatches = findEmojisInString(lineStr, detectEmoticons);
                for (var lm = 0; lm < lineMatches.length; lm++) {
                    var match = lineMatches[lm];
                    var prefix = lineStr.substring(0, match.start);
                    var prefixAdv = measurer.measurePrefixAdvance(prefix);
                    var segX = lineLeftX + prefixAdv;
                    var emojiAdv = measurer.measurePrefixAdvance(prefix + match.char) - prefixAdv;
                    if (emojiAdv <= 0) emojiAdv = props.fontSize;

                    var emojiCenterX = segX + (emojiAdv / 2);
                    // Center vertically on typography ascender / cap height
                    var emojiCenterY = lineBaselineY - (props.fontSize * 0.35);

                    matchedEmojis.push({
                        char: match.char,
                        hexcode: match.hexcode,
                        entry: match.entry,
                        posX: emojiCenterX,
                        posY: emojiCenterY,
                        visualLine: vl
                    });
                }
            }

            if (matchedEmojis.length === 0) {
                return { createdCount: 0, emojiCount: 0, shapeLayer: null };
            }

            // 2. Hide Monochrome Font Emojis on Intact Text Layer via native Text Animator (Opacity = 0%)
            try {
                var textPropGroup = origLayer.property("ADBE Text Properties");
                var animators = textPropGroup ? textPropGroup.property("ADBE Text Animators") : null;
                if (animators) {
                    var existingAnim = animators.property("Replace Color Emojis - Hide Font Emojis");
                    if (existingAnim) {
                        try { existingAnim.remove(); } catch (eRem) {}
                    }

                    var fullMatches = findEmojisInString(props.fullText, detectEmoticons);
                    if (fullMatches.length > 0) {
                        var anim = animators.addProperty("ADBE Text Animator");
                        if (anim) {
                            anim.name = "Replace Color Emojis - Hide Font Emojis";
                            var animProps = anim.property("ADBE Text Animator Properties");
                            var opProp = animProps ? animProps.addProperty("ADBE Text Opacity") : null;
                            if (opProp) {
                                opProp.setValue(0);
                            }

                            var selectors = anim.property("ADBE Text Selectors") || anim.property("Selectors");
                            if (selectors) {
                                var totalChars = Math.max(1, props.fullText.length);
                                for (var fmi = 0; fmi < fullMatches.length; fmi++) {
                                    var fMatch = fullMatches[fmi];
                                    var sel = (fmi === 0 && selectors.numProperties > 0)
                                        ? selectors.property(1)
                                        : selectors.addProperty("ADBE Text Selector");
                                    if (sel) {
                                        sel.name = "Hide Emoji " + (fmi + 1) + " (" + fMatch.char + ")";
                                        var adv = sel.property("ADBE Text Range Advanced");
                                        var usedIndex = false;
                                        if (adv) {
                                            var uProp = adv.property("ADBE Text Range Units2");
                                            if (uProp) {
                                                try {
                                                    uProp.setValue(2); // 2 = Index
                                                    usedIndex = true;
                                                } catch (eU) {}
                                            }
                                        }

                                        var pStart = sel.property("ADBE Text Index Start") || sel.property("ADBE Text Percent Start") || sel.property("Start");
                                        var pEnd = sel.property("ADBE Text Index End") || sel.property("ADBE Text Percent End") || sel.property("End");
                                        var mEnd = fMatch.start + fMatch.length;

                                        if (usedIndex) {
                                            if (pStart) pStart.setValue(fMatch.start);
                                            if (pEnd) pEnd.setValue(mEnd);
                                        } else {
                                            if (pStart) pStart.setValue((fMatch.start / totalChars) * 100);
                                            if (pEnd) pEnd.setValue((mEnd / totalChars) * 100);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (eAnim) {}

            // 3. Create Full-Color Vector Emoji Shape Layer(s)
            var primaryShapeLayer = null;

            if (layerMode === "single") {
                // Unified Single Master Shape Layer
                var shapeLayer = comp.layers.addShape();
                shapeLayer.name = origLayer.name + " - Color Emojis";
                shapeLayer.label = 9;
                shapeLayer.comment = "AE_COLOR_EMOJI_CHILD";
                primaryShapeLayer = shapeLayer;

                var fxGroup = shapeLayer.property("ADBE Effect Parade") || shapeLayer.property("Effects");
                if (fxGroup) {
                    var srcIdx = 1;
                    for (var s = 0; s < EMOJI_SOURCES.length; s++) {
                        if (EMOJI_SOURCES[s].id === sourceId) { srcIdx = EMOJI_SOURCES[s].index; break; }
                    }
                    ensureEffectSlider(fxGroup, "Emoji Source (1=OM,2=TW,3=Flat,4=Blk)", srcIdx);
                    ensureEffectSlider(fxGroup, "Emoji Size (px)", props.fontSize);
                    ensureEffectSlider(fxGroup, "Emoji Size Multiplier %", sizeMult);
                    ensureEffectSlider(fxGroup, "Outline Width %", outlinePct);
                    ensureEffectCheckbox(fxGroup, "Show Outlines", showOutlines);
                    ensureEffectSlider(fxGroup, "Offset X", offX);
                    ensureEffectSlider(fxGroup, "Offset Y", offY);
                }

                var rootVectors = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");
                clearRootVectorContents(rootVectors);

                for (var me = 0; me < matchedEmojis.length; me++) {
                    var mItem = matchedEmojis[me];
                    buildVectorGroupForEmoji(rootVectors, mItem.entry, sourceId, props.fontSize, mItem.posX, mItem.posY, outlinePct, showOutlines);
                }

                shapeLayer.parent = origLayer;
                shapeLayer.transform.position.setValue([0, 0, 0]);
                shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
                shapeLayer.transform.scale.setValue([100, 100, 100]);

                try {
                    if (typeof shapeLayer.moveBefore === "function") {
                        shapeLayer.moveBefore(origLayer);
                    }
                } catch (eMove) {}

                createdLayers.push(shapeLayer);

            } else {
                // Separate Shape Layer per Emoji
                for (var sei = 0; sei < matchedEmojis.length; sei++) {
                    var sItem = matchedEmojis[sei];
                    var sLayer = comp.layers.addShape();
                    sLayer.name = origLayer.name + " - Emoji " + (sei + 1) + " " + sItem.char;
                    sLayer.label = 9;
                    sLayer.comment = "AE_COLOR_EMOJI_CHILD";
                    if (!primaryShapeLayer) primaryShapeLayer = sLayer;

                    var sFx = sLayer.property("ADBE Effect Parade") || sLayer.property("Effects");
                    if (sFx) {
                        ensureEffectSlider(sFx, "Emoji Size (px)", props.fontSize);
                        ensureEffectSlider(sFx, "Emoji Size Multiplier %", sizeMult);
                        ensureEffectSlider(sFx, "Outline Width %", outlinePct);
                        ensureEffectCheckbox(sFx, "Show Outlines", showOutlines);
                        ensureEffectSlider(sFx, "Offset X", offX);
                        ensureEffectSlider(sFx, "Offset Y", offY);
                    }

                    var sRoots = sLayer.property("ADBE Root Vectors Group") || sLayer.property("Contents");
                    clearRootVectorContents(sRoots);

                    buildVectorGroupForEmoji(sRoots, sItem.entry, sourceId, props.fontSize, 0, 0, outlinePct, showOutlines);

                    sLayer.parent = origLayer;
                    sLayer.transform.anchorPoint.setValue([0, 0, 0]);
                    sLayer.transform.position.setValue([sItem.posX, sItem.posY, 0]);
                    sLayer.transform.scale.setValue([100, 100, 100]);

                    try {
                        sLayer.transform.position.expression = [
                            'var ox = 0, oy = 0;',
                            'try { ox = effect("Offset X")(1).value; } catch(e1) {}',
                            'try { oy = effect("Offset Y")(1).value; } catch(e2) {}',
                            '[' + sItem.posX.toFixed(2) + ' + ox, ' + sItem.posY.toFixed(2) + ' + oy, 0];'
                        ].join('\n');
                    } catch (ePos) {}

                    try {
                        if (typeof sLayer.moveBefore === "function") {
                            sLayer.moveBefore(origLayer);
                        }
                    } catch (eMove2) {}

                    createdLayers.push(sLayer);
                }
            }

            // 4. Precomposition Option (Zero-Shift)
            if (options.makePrecomp && createdLayers.length > 0) {
                var precompLayers = createdLayers.slice();
                var textCopy = origLayer.duplicate ? origLayer.duplicate() : null;
                if (textCopy) {
                    textCopy.enabled = true;
                    textCopy.guideLayer = false;
                    precompLayers.push(textCopy);
                    markOriginalAsGuideline(origLayer);
                }
                var preName = origLayer.name + " Color Emoji Precomp";
                precomposeWithZeroShift(comp, origLayer, props, precompLayers, preName, primaryShapeLayer, options);
            }

            return {
                createdCount: createdLayers.length,
                emojiCount: matchedEmojis.length,
                shapeLayer: primaryShapeLayer
            };

        } finally {
            measurer.cleanup();
        }
    }

    // =========================================================================
    // 8. SPLIT METHOD (LAYER DECOMPOSITION ENGINE)
    // =========================================================================
    function buildSplitEmojiRig(comp, origLayer, options) {
        if (!comp || !origLayer || !isTextLayer(origLayer)) return null;

        var props = getTextBoxProperties(comp, origLayer);
        if (!props || !props.metrics) return null;

        alignAnchorPointToJustification(origLayer, props);

        var sourceId = options.sourceId || "openmoji_color";
        var sizeMult = (typeof options.sizeMultiplier === "number") ? options.sizeMultiplier : 100;
        var outlinePct = (typeof options.outlineWidth === "number") ? options.outlineWidth : 100;
        var showOutlines = (options.showOutlines !== false);
        var offX = (typeof options.offsetX === "number") ? options.offsetX : 0;
        var offY = (typeof options.offsetY === "number") ? options.offsetY : 0;
        var detectEmoticons = Boolean(options.detectEmoticons);

        var lines = props.metrics.lines;
        var lineStep = props.leading || (props.fontSize * 1.2);
        var just = props.justification || "left";

        var measurer = createMeasureHelper(comp, props);

        var rFirst = measurer.measureRect(lines.length > 0 ? lines[0] : "A");
        var ascender = Math.abs(rFirst.top) || (props.fontSize * 0.78);
        var firstBaselineY = (props.isBox ? props.boxPos[1] : props.sRect.top) + ascender;

        var createdLayers = [];
        var totalEmojiCount = 0;
        var primaryShapeLayer = null;

        try {
            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (trimStr(lineStr).length === 0) continue;

                var lineW = measurer.measureRect(lineStr).width;
                var lineBaselineY = firstBaselineY + (vl * lineStep);

                var lineLeftX = 0;
                if (props.isBox) {
                    if (just === "center") lineLeftX = props.boxPos[0] + (props.boxWidth - lineW) / 2;
                    else if (just === "right") lineLeftX = props.boxPos[0] + props.boxWidth - lineW;
                    else lineLeftX = props.boxPos[0];
                } else {
                    if (just === "center") lineLeftX = -lineW / 2;
                    else if (just === "right") lineLeftX = -lineW;
                    else lineLeftX = 0;
                }

                var lineMatches = findEmojisInString(lineStr, detectEmoticons);

                if (lineMatches.length === 0) {
                    // Line without emojis -> create independent text box for line
                    var lineLayer = comp.layers.addText(lineStr);
                    applyTextDocCopy(lineLayer, props.textDoc, lineStr, props.fillColor);
                    lineLayer.name = origLayer.name + " [Line " + (vl + 1) + "]";
                    lineLayer.comment = "AE_COLOR_EMOJI_CHILD";

                    var rL = lineLayer.sourceRectAtTime(comp.time, false);
                    lineLayer.transform.anchorPoint.setValue([rL.left, rL.top, 0]);
                    lineLayer.transform.position.setValue([lineLeftX + rL.left, lineBaselineY + rL.top, 0]);
                    lineLayer.parent = origLayer;
                    createdLayers.push(lineLayer);
                    continue;
                }

                // Decompose line around emojis
                var segments = [];
                var curPos = 0;
                for (var m = 0; m < lineMatches.length; m++) {
                    var match = lineMatches[m];
                    if (match.start > curPos) {
                        segments.push({
                            isEmoji: false,
                            text: lineStr.substring(curPos, match.start),
                            colStart: curPos
                        });
                    }
                    segments.push({
                        isEmoji: true,
                        match: match,
                        colStart: match.start
                    });
                    curPos = match.start + match.length;
                }
                if (curPos < lineStr.length) {
                    segments.push({
                        isEmoji: false,
                        text: lineStr.substring(curPos),
                        colStart: curPos
                    });
                }

                for (var segIdx = 0; segIdx < segments.length; segIdx++) {
                    var seg = segments[segIdx];
                    var prefix = lineStr.substring(0, seg.colStart);
                    var prefixAdv = measurer.measurePrefixAdvance(prefix);
                    var segX = lineLeftX + prefixAdv;

                    if (!seg.isEmoji) {
                        if (trimStr(seg.text).length === 0) continue;
                        var txtLayer = comp.layers.addText(seg.text);
                        applyTextDocCopy(txtLayer, props.textDoc, seg.text, props.fillColor);
                        txtLayer.name = origLayer.name + " [Text] " + seg.text.substr(0, 16);
                        txtLayer.comment = "AE_COLOR_EMOJI_CHILD";

                        var rSeg = txtLayer.sourceRectAtTime(comp.time, false);
                        txtLayer.transform.anchorPoint.setValue([rSeg.left, rSeg.top, 0]);
                        txtLayer.transform.position.setValue([segX + rSeg.left, lineBaselineY + rSeg.top, 0]);
                        txtLayer.parent = origLayer;
                        createdLayers.push(txtLayer);

                    } else {
                        totalEmojiCount++;
                        var eMatch = seg.match;
                        var emojiAdv = measurer.measurePrefixAdvance(prefix + eMatch.char) - prefixAdv;
                        if (emojiAdv <= 0) emojiAdv = props.fontSize;

                        var emojiCenterX = segX + (emojiAdv / 2);
                        var emojiCenterY = lineBaselineY - (props.fontSize * 0.35);

                        var emoLayer = comp.layers.addShape();
                        emoLayer.name = origLayer.name + " [Emoji] " + eMatch.char + " " + eMatch.hexcode;
                        emoLayer.label = 9;
                        emoLayer.comment = "AE_COLOR_EMOJI_CHILD";
                        if (!primaryShapeLayer) primaryShapeLayer = emoLayer;

                        var efx = emoLayer.property("ADBE Effect Parade") || emoLayer.property("Effects");
                        if (efx) {
                            ensureEffectSlider(efx, "Emoji Size (px)", props.fontSize);
                            ensureEffectSlider(efx, "Emoji Size Multiplier %", sizeMult);
                            ensureEffectSlider(efx, "Outline Width %", outlinePct);
                            ensureEffectCheckbox(efx, "Show Outlines", showOutlines);
                            ensureEffectSlider(efx, "Offset X", offX);
                            ensureEffectSlider(efx, "Offset Y", offY);
                        }

                        var eRoots = emoLayer.property("ADBE Root Vectors Group") || emoLayer.property("Contents");
                        clearRootVectorContents(eRoots);

                        buildVectorGroupForEmoji(eRoots, eMatch.entry, sourceId, props.fontSize, 0, 0, outlinePct, showOutlines);

                        emoLayer.parent = origLayer;
                        emoLayer.transform.anchorPoint.setValue([0, 0, 0]);
                        emoLayer.transform.position.setValue([emojiCenterX, emojiCenterY, 0]);
                        emoLayer.transform.scale.setValue([100, 100, 100]);

                        try {
                            emoLayer.transform.position.expression = [
                                'var ox = 0, oy = 0;',
                                'try { ox = effect("Offset X")(1).value; } catch(e1) {}',
                                'try { oy = effect("Offset Y")(1).value; } catch(e2) {}',
                                '[' + emojiCenterX.toFixed(2) + ' + ox, ' + emojiCenterY.toFixed(2) + ' + oy, 0];'
                            ].join('\n');
                        } catch (ePos2) {}

                        createdLayers.push(emoLayer);
                    }
                }
            }

            // Hide original text layer as guideline
            markOriginalAsGuideline(origLayer);

            // Precomposition Option
            if (options.makePrecomp && createdLayers.length > 0) {
                var preNameSplit = origLayer.name + " Color Emoji Precomp";
                precomposeWithZeroShift(comp, origLayer, props, createdLayers, preNameSplit, primaryShapeLayer, options);
            }

            return {
                createdCount: createdLayers.length,
                emojiCount: totalEmojiCount,
                shapeLayer: primaryShapeLayer
            };

        } finally {
            measurer.cleanup();
        }
    }

    // =========================================================================
    // 9. ZERO-SHIFT PRECOMPOSITION ENGINE (From AE-text-precomp & AE-Text-Highlight)
    // =========================================================================
    function precomposeWithZeroShift(comp, origLayer, props, layersToPrecompose, precompName, shapeLayer, options) {
        if (!comp || !layersToPrecompose || layersToPrecompose.length === 0) return null;
        try {
            var layerIndices = [];
            for (var k = 0; k < layersToPrecompose.length; k++) {
                if (layersToPrecompose[k] && typeof layersToPrecompose[k].index === "number") {
                    layerIndices.push(layersToPrecompose[k].index);
                }
            }
            if (layerIndices.length === 0) return null;

            var precompLayer = comp.layers.precompose(layerIndices, precompName, true);
            if (precompLayer) {
                precompLayer.comment = "AE_COLOR_EMOJI_CHILD";
                precompLayer.label = 9;

                var bounds = props.isBox
                    ? { left: props.boxPos[0], top: props.boxPos[1], width: props.boxWidth, height: props.boxHeight }
                    : props.sRect;

                var tr = precompLayer.transform;
                if (tr) {
                    tr.anchorPoint.setValue([0, 0, 0]);
                    var origPos = origLayer.transform.position.value;
                    tr.position.setValue([origPos[0], origPos[1], origPos[2] || 0]);
                }
                return precompLayer;
            }
        } catch (ePre) {}
        return null;
    }

    // =========================================================================
    // 10. CLEAN RESTORE / UNDO ENGINE
    // =========================================================================
    function removeEmojisAndRestoreOriginal(comp) {
        if (!comp) return 0;
        var removedCount = 0;
        try {
            var layers = comp.layers;
            var num = (layers && layers.length) ? layers.length : (comp.numLayers || 0);

            // 1. Remove created child layers
            for (var i = num; i >= 1; i--) {
                var l = (layers && layers._layers) ? layers._layers[i - 1] : layers[i];
                if (!l) continue;

                var isChild = false;
                try {
                    if (l.comment === "AE_COLOR_EMOJI_CHILD") isChild = true;
                } catch (eC) {}

                var name = l.name || "";
                if (name.indexOf(" - Color Emojis") !== -1 ||
                    name.indexOf(" - Emoji ") !== -1 ||
                    name.indexOf(" [Emoji]") !== -1 ||
                    name.indexOf(" Color Emoji Precomp") !== -1) {
                    isChild = true;
                }

                if (isChild) {
                    try {
                        l.remove();
                        removedCount++;
                    } catch (eRem) {}
                }
            }

            // 2. Restore all text layers (remove animator and re-enable)
            var currentNum = (layers && layers.length) ? layers.length : (comp.numLayers || 0);
            for (var j = 1; j <= currentNum; j++) {
                var tl = (layers && layers._layers) ? layers._layers[j - 1] : layers[j];
                if (!tl || !isTextLayer(tl)) continue;

                try {
                    tl.enabled = true;
                    tl.guideLayer = false;
                } catch (eEn) {}

                try {
                    var textProp = tl.property("ADBE Text Properties");
                    var animators = textProp ? textProp.property("ADBE Text Animators") : null;
                    if (animators) {
                        var anim = animators.property("Replace Color Emojis - Hide Font Emojis");
                        if (anim) {
                            anim.remove();
                        }
                    }
                } catch (eAnimRem) {}
            }
        } catch (eClean) {}
        return removedCount;
    }

    // =========================================================================
    // 11. SCRIPTUI INTERFACE
    // =========================================================================
    function buildUI(thisObj) {
        var isDockable = (thisObj instanceof Panel);
        var win = isDockable
            ? thisObj
            : new Window("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;
        win.minimumSize = [340, 520];

        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        // --- Header Panel ---
        var pnlHeader = win.add("panel", undefined, SCRIPT_TITLE + " " + SCRIPT_VERSION);
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblSub = pnlHeader.add("statictext", undefined, "Procedural Full-Color Vector Emoji Replacement Engine");
        try {
            lblSub.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.65, 0.95, 1], 1);
        } catch (eG1) {}

        var lblRef = pnlHeader.add("statictext", undefined, "Native Shape Layers • OpenMoji & Twemoji • Sub-Pixel Alignment");
        lblRef.helpTip = GITHUB_REPO_URL;

        // --- Method Selector Panel ---
        var pnlMethod = win.add("panel", undefined, "1. Replacement Method");
        pnlMethod.orientation = "column";
        pnlMethod.alignChildren = ["fill", "top"];
        pnlMethod.spacing = 4;
        pnlMethod.margins = [8, 6, 8, 6];

        var grpMethodRow = pnlMethod.add("group");
        grpMethodRow.orientation = "row";
        grpMethodRow.alignChildren = ["left", "center"];
        grpMethodRow.spacing = 8;

        grpMethodRow.add("statictext", undefined, "Method:");
        var ddMethod = grpMethodRow.add("dropdownlist", undefined, [
            "📐 Calculation Method (Intact Text Box - Recommended)",
            "✂️ Split Method (Decompose Lines & Segments)"
        ]);
        ddMethod.selection = 0;
        ddMethod.alignment = ["fill", "center"];

        var lblMethodDesc = pnlMethod.add("statictext", undefined, "Keeps text layer 100% intact; hides font emojis via Text Animator (Opacity 0%).");
        lblMethodDesc.alignment = ["fill", "top"];
        try {
            lblMethodDesc.graphics.foregroundColor = lblMethodDesc.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.75, 0.75, 0.75, 1.0], 1);
        } catch (eG2) {}

        // --- Target Text Layer & Status Panel ---
        var pnlTarget = win.add("panel", undefined, "2. Active Text Layer & Emoji Scanner");
        pnlTarget.orientation = "column";
        pnlTarget.alignChildren = ["fill", "top"];
        pnlTarget.spacing = 5;
        pnlTarget.margins = [8, 6, 8, 6];

        var lblStatus = pnlTarget.add("statictext", undefined, "Detecting active selection...");
        lblStatus.alignment = ["fill", "top"];
        try {
            lblStatus.graphics.foregroundColor = lblStatus.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 1.0, 1.0], 1);
        } catch (eG3) {}

        var grpTargetBtns = pnlTarget.add("group");
        grpTargetBtns.orientation = "row";
        grpTargetBtns.alignChildren = ["fill", "center"];
        grpTargetBtns.spacing = 6;

        var btnRefresh = grpTargetBtns.add("button", undefined, "🔄 Detect Layer");
        btnRefresh.helpTip = "Check active composition and inspect the currently selected text layer.";

        var btnScan = grpTargetBtns.add("button", undefined, "👀 Scan Emojis");
        btnScan.helpTip = "Scan selected text layer and preview detected emojis.";

        var btnDemo = grpTargetBtns.add("button", undefined, "📝 Demo Text");
        btnDemo.helpTip = "Create a sample text layer with popular emojis and emoticons for instant 1-click testing.";

        // --- Emoji Detection & Vector Source Panel ---
        var pnlSource = win.add("panel", undefined, "3. Vector Style & Detection Options");
        pnlSource.orientation = "column";
        pnlSource.alignChildren = ["fill", "top"];
        pnlSource.spacing = 5;
        pnlSource.margins = [8, 6, 8, 6];

        var grpDetectRow = pnlSource.add("group");
        grpDetectRow.orientation = "row";
        grpDetectRow.alignChildren = ["left", "center"];
        grpDetectRow.spacing = 10;

        var chkUnicode = grpDetectRow.add("checkbox", undefined, "Unicode Emojis (😃, 🚀, ❤️, 🔥)");
        chkUnicode.value = true;
        chkUnicode.helpTip = "Detect standard Unicode emojis and surrogate pairs.";

        var chkEmoticons = grpDetectRow.add("checkbox", undefined, "Text Emoticons (:D, :fire:, <3)");
        chkEmoticons.value = true;
        chkEmoticons.helpTip = "Also detect Western sideways emoticons and shortcodes from the Wikipedia Emoticons database.";

        var grpSrcRow = pnlSource.add("group");
        grpSrcRow.orientation = "row";
        grpSrcRow.alignChildren = ["left", "center"];
        grpSrcRow.spacing = 6;

        grpSrcRow.add("statictext", undefined, "Vector Style:");
        var srcLabels = [];
        for (var si = 0; si < EMOJI_SOURCES.length; si++) srcLabels.push(EMOJI_SOURCES[si].label);
        var ddSource = grpSrcRow.add("dropdownlist", undefined, srcLabels);
        ddSource.selection = 0;
        ddSource.alignment = ["fill", "center"];

        var btnReloadJSON = grpSrcRow.add("button", undefined, "↻");
        btnReloadJSON.preferredSize = [26, 24];
        btnReloadJSON.helpTip = "Reload JSON database from /emojis/ folder.";

        var grpModeRow = pnlSource.add("group");
        grpModeRow.orientation = "row";
        grpModeRow.alignChildren = ["left", "center"];
        grpModeRow.spacing = 6;

        grpModeRow.add("statictext", undefined, "Layer Mode:");
        var ddLayerMode = grpModeRow.add("dropdownlist", undefined, [
            "📦 Single Master Shape Layer (Clean Timeline)",
            "📑 Separate Shape Layer per Emoji"
        ]);
        ddLayerMode.selection = 0;
        ddLayerMode.alignment = ["fill", "center"];

        // --- Sizing, Offset & Outline Controls Panel ---
        var pnlSizing = win.add("panel", undefined, "4. Emoji Sizing, Offsets & Outlines");
        pnlSizing.orientation = "column";
        pnlSizing.alignChildren = ["fill", "top"];
        pnlSizing.spacing = 4;
        pnlSizing.margins = [8, 6, 8, 6];

        function addSliderRow(parent, label, min, max, defaultVal, unit) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["left", "center"];
            g.spacing = 6;

            var lbl = g.add("statictext", undefined, label);
            lbl.preferredSize.width = 110;

            var sld = g.add("slider", undefined, defaultVal, min, max);
            sld.alignment = ["fill", "center"];

            var txt = g.add("edittext", undefined, String(defaultVal));
            txt.preferredSize.width = 46;

            if (unit) g.add("statictext", undefined, unit);

            sld.onChanging = function () { txt.text = String(Math.round(this.value)); };
            txt.onChange = function () {
                var v = Number(this.text);
                if (!isNaN(v)) sld.value = Math.max(min, Math.min(max, v));
            };

            return {
                getValue: function () { return Number(txt.text) || sld.value; },
                setValue: function (v) { sld.value = v; txt.text = String(v); }
            };
        }

        var sldMult = addSliderRow(pnlSizing, "Size Multiplier:", 50, 200, 100, "%");
        var sldOffY = addSliderRow(pnlSizing, "Vertical Offset (Y):", -50, 50, 0, "px");
        var sldOffX = addSliderRow(pnlSizing, "Horizontal Offset (X):", -50, 50, 0, "px");
        var sldOutline = addSliderRow(pnlSizing, "Outline Width:", 0, 200, 100, "%");

        var grpCheckRow = pnlSizing.add("group");
        grpCheckRow.orientation = "row";
        grpCheckRow.alignChildren = ["left", "center"];
        grpCheckRow.spacing = 16;

        var chkShowOutlines = grpCheckRow.add("checkbox", undefined, "Show Outlines");
        chkShowOutlines.value = true;

        var chkMakePrecomp = grpCheckRow.add("checkbox", undefined, "Make Precomp Out of Rig");
        chkMakePrecomp.value = false;

        // --- Action Buttons ---
        var pnlActions = win.add("panel", undefined, "5. Execute");
        pnlActions.orientation = "column";
        pnlActions.alignChildren = ["fill", "top"];
        pnlActions.spacing = 6;
        pnlActions.margins = [8, 8, 8, 8];

        var btnExecute = pnlActions.add("button", undefined, "✨ Replace Font Emojis with Color Emojis");
        btnExecute.preferredSize = [-1, 34];
        try {
            btnExecute.graphics.foregroundColor = btnExecute.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.1, 0.5, 0.9, 1], 1);
        } catch (eBCol) {}

        var btnRestore = pnlActions.add("button", undefined, "↺ Remove Emojis & Restore Original Text");
        btnRestore.preferredSize = [-1, 26];

        // --- Footer ---
        var grpFooter = win.add("group");
        grpFooter.orientation = "row";
        grpFooter.alignChildren = ["center", "center"];
        var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE-replace-color-emojis");
        try {
            lblRepo.graphics.foregroundColor = lblRepo.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.4, 0.7, 1.0, 1.0], 1);
        } catch (eGF) {}

        // ---------------------------------------------------------------------
        // EVENT HANDLERS & LOGIC
        // ---------------------------------------------------------------------
        function getActiveComp() {
            if (typeof app !== "undefined" && app.project && app.project.activeItem && (app.project.activeItem instanceof CompItem)) {
                return app.project.activeItem;
            }
            return null;
        }

        function updateSelectionStatus() {
            var comp = getActiveComp();
            if (!comp) {
                lblStatus.text = "⚠️ No active composition found.";
                return null;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblStatus.text = "⚠️ Please select a Text Layer in the active composition.";
                return null;
            }

            var textStr = getTextLayerString(textLayer);
            var matches = findEmojisInString(textStr, chkEmoticons.value);
            var emojiNames = [];
            for (var mi = 0; mi < Math.min(4, matches.length); mi++) {
                emojiNames.push(matches[mi].char);
            }
            var emojiSummary = (matches.length > 0)
                ? (matches.length + " emoji(s) found [" + emojiNames.join(" ") + (matches.length > 4 ? "..." : "") + "]")
                : "0 emojis detected in text";

            lblStatus.text = "Layer: '" + textLayer.name.substr(0, 18) + "' • " + emojiSummary;
            return textLayer;
        }

        ddMethod.onChange = function () {
            if (ddMethod.selection.index === 0) {
                lblMethodDesc.text = "Keeps text layer 100% intact; hides font emojis via Text Animator (Opacity 0%).";
            } else {
                lblMethodDesc.text = "Decomposes target lines and segments into independent text boxes (top-left anchors).";
            }
        };

        btnRefresh.onClick = function () {
            updateSelectionStatus();
        };

        btnScan.onClick = function () {
            var comp = getActiveComp();
            var textLayer = updateSelectionStatus();
            if (!comp || !textLayer) return;

            var textStr = getTextLayerString(textLayer);
            var matches = findEmojisInString(textStr, chkEmoticons.value);
            if (matches.length === 0) {
                alert("No emojis or emoticons found in layer '" + textLayer.name + "'.\n\nTry adding emojis like 😃 🚀 🔥 ❤️ or emoticons like :D :fire:");
                return;
            }
            var list = [];
            for (var m = 0; m < matches.length; m++) {
                var itm = matches[m];
                var nm = itm.entry ? itm.entry.name : "Unicode " + itm.hexcode;
                list.push((m + 1) + ". " + itm.char + " [" + itm.hexcode + "] - " + nm);
            }
            alert("Found " + matches.length + " emoji(s) in '" + textLayer.name + "':\n\n" + list.slice(0, 15).join("\n") + (list.length > 15 ? "\n...and " + (list.length - 15) + " more" : ""));
        };

        btnDemo.onClick = function () {
            var comp = getActiveComp();
            if (!comp) {
                alert("Please open or create a composition first.");
                return;
            }
            try {
                if (typeof app !== "undefined" && app.beginUndoGroup) {
                    app.beginUndoGroup("Create Demo Text Layer with Emojis");
                }
                var demoStr = "Hello After Effects! 😃 We now have color emojis! 🚀🔥 With red heart ❤️ and smile :D ✨";
                var demoLayer = comp.layers.addText(demoStr);
                demoLayer.name = "Demo Text with Emojis";
                var tr = demoLayer.transform;
                if (tr) {
                    tr.position.setValue([Math.round(comp.width / 2), Math.round(comp.height / 2), 0]);
                }
                try {
                    var doc = getTextDocument(demoLayer);
                    if (doc) {
                        doc.fontSize = 54;
                        doc.fillColor = [1, 1, 1];
                        if (typeof ParagraphJustification !== "undefined") {
                            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
                        }
                        var prop = demoLayer.property("Source Text");
                        if (prop) prop.setValue(doc);
                    }
                } catch (eDoc) {}

                try {
                    if (comp.layers && comp.layers._layers) {
                        for (var i = 0; i < comp.layers._layers.length; i++) {
                            comp.layers._layers[i].selected = (comp.layers._layers[i] === demoLayer);
                        }
                    }
                    demoLayer.selected = true;
                } catch (eSel) {}

                updateSelectionStatus();
            } finally {
                if (typeof app !== "undefined" && app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };

        btnReloadJSON.onClick = function () {
            loadAllEmojiDatabases();
            alert("Emoji database reloaded! Loaded " + emojiCatalog.length + " catalog emojis and " + Object.keys(wikiEmoticonMap).length + " emoticon mappings.");
            updateSelectionStatus();
        };

        btnRestore.onClick = function () {
            var comp = getActiveComp();
            if (!comp) {
                alert("No active composition found.");
                return;
            }
            try {
                if (typeof app !== "undefined" && app.beginUndoGroup) {
                    app.beginUndoGroup("Remove Emojis & Restore Original");
                }
                var removed = removeEmojisAndRestoreOriginal(comp);
                alert("Restore complete! Cleaned up " + removed + " emoji / helper layer(s) and restored original text layer(s).");
                updateSelectionStatus();
            } finally {
                if (typeof app !== "undefined" && app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };

        btnExecute.onClick = function () {
            var comp = getActiveComp();
            if (!comp) {
                if (isBrowserSim() && typeof app !== "undefined" && app.project && typeof app.project.addComp === "function") {
                    comp = app.project.addComp("Main Comp", 1920, 1080, 1, 10, 30);
                } else {
                    alert("Please open a composition in After Effects first.");
                    return;
                }
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                // Auto-create demo text layer if none is selected (essential for simulator autobuild)
                btnDemo.onClick();
                textLayer = getSelectedTextLayer(comp);
            }
            if (!textLayer) {
                alert("Please select a text layer containing emojis (e.g. 😃 🚀 🔥 ❤️) or click '📝 Demo Text'.");
                return;
            }

            var srcObj = EMOJI_SOURCES[ddSource.selection ? ddSource.selection.index : 0] || EMOJI_SOURCES[0];
            var isSplit = (ddMethod.selection && ddMethod.selection.index === 1);
            var isSeparate = (ddLayerMode.selection && ddLayerMode.selection.index === 1);

            var opts = {
                sourceId: srcObj.id,
                sizeMultiplier: sldMult.getValue(),
                outlineWidth: sldOutline.getValue(),
                showOutlines: chkShowOutlines.value,
                offsetX: sldOffX.getValue(),
                offsetY: sldOffY.getValue(),
                detectEmoticons: chkEmoticons.value,
                makePrecomp: chkMakePrecomp.value,
                layerMode: isSeparate ? "separate" : "single"
            };

            try {
                if (typeof app !== "undefined" && app.beginUndoGroup) {
                    app.beginUndoGroup("Replace Font Emojis with Color Emojis");
                }

                var res = isSplit
                    ? buildSplitEmojiRig(comp, textLayer, opts)
                    : buildCalculationEmojiRig(comp, textLayer, opts);

                if (!res || res.emojiCount === 0) {
                    alert("No emojis detected in text layer '" + textLayer.name + "'.\n\nEnsure the text contains Unicode emojis (😃 🚀 🔥) or emoticons (:D, :fire:).");
                    return;
                }

                var summary = "✨ Replaced " + res.emojiCount + " emoji(s) using "
                    + (isSplit ? "Split Method" : "Calculation Method") + " ("
                    + (isSeparate ? (res.createdCount + " shape layers") : "1 master shape layer") + ")!";

                lblStatus.text = summary;

                if (comp._onChanged) {
                    try { comp._onChanged(); } catch (eChg) {}
                }

            } catch (err) {
                alert("Error replacing emojis: " + err);
            } finally {
                if (typeof app !== "undefined" && app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };

        // Live selection sync in AE_JS_builder simulator
        if (typeof window !== "undefined") {
            window.addEventListener("ae-layer-selection-changed", function () {
                try { updateSelectionStatus(); } catch (e) {}
            });
        }
        win.onActivate = function () {
            try { updateSelectionStatus(); } catch (e) {}
        };

        updateSelectionStatus();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }

        return win;
    }

    // Launch ScriptUI Panel
    buildUI(thisObj);

})(this);

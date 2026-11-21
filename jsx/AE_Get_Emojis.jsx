/**
 * ============================================================================
 * AE Get Emojis v1.0 — Full-Color Vector Emojis for Adobe After Effects
 * ============================================================================
 * Purpose:
 *   Quickly search, index, and add or replace full-color vector emojis as native
 *   After Effects Shape Layers (since After Effects does not natively render
 *   color emoji fonts like Apple Color Emoji / Noto Color Emoji / Segoe UI Emoji).
 *
 * Features:
 *   1. JSON Database in /emojis/ Subfolder:
 *      - emojis/emoji_index.json         (291 indexed emojis with metadata & tags)
 *      - emojis/wikipedia_emoticons.json (Wikipedia List of Emoticons mappings)
 *      - emojis/openmoji_color.json      (OpenMoji handcrafted color + outlines)
 *      - emojis/twemoji_color.json       (Twemoji flat full-color vector shapes)
 *      - emojis/openmoji_black.json      (OpenMoji black line-art vector shapes)
 *   2. Multi-Source Pulldown:
 *      - OpenMoji Color (https://github.com/hfg-gmuend/openmoji)
 *      - Twemoji Flat Color (https://github.com/jdecked/twemoji)
 *      - OpenMoji Flat Color (Color layer only, no black outlines)
 *      - OpenMoji Black Line Art (Wireframe / line art)
 *   3. Smart Search & Lookup:
 *      - Search by Emoji Name ("grinning", "heart", "fire", "rocket", "shrug")
 *      - Search by Unicode Hex ("1F603", "U+1F603", "0x1F603", "2764")
 *      - Search by Unicode Integer ("128515", "128578", "10084")
 *      - Search by Emoji Glyph ("😃", "❤️", "🔥", "🚀")
 *      - Search by Wikipedia Emoticon (":D", ":)", ";)", ":P", "<3", "</3",
 *        "XD", ":'(", ">:(", "D:", ":O", ":3", "B-)", "O:)", "¯\_(ツ)_/¯", etc.)
 *        sourced from https://en.wikipedia.org/wiki/List_of_emoticons
 *   4. Unicode <-> Integer Conversion & Slider Indexing:
 *      - Bidirectional conversion between Unicode Hex (e.g. U+1F603) and
 *        32-bit Integer (e.g. 128515 = parseInt("1F603", 16)).
 *      - Interactive Catalog Index Slider & Unicode Integer Slider in the UI,
 *        plus Effect Slider Controls ("Emoji Index", "Emoji Unicode Int",
 *        "Emoji Source", "Emoji Size (px)", "Outline Width %", "Show Outlines")
 *        on every generated After Effects Shape Layer.
 *   5. Smart "Add Emoji" / "Replace Emoji" Button:
 *      - Places the located emoji into a new native Shape Layer.
 *      - Automatically detects if an Emoji Shape Layer is selected in the active
 *        composition and switches the button label to "Replace Emoji" (or
 *        "Add / Replace Emoji" when selection detection is unavailable).
 *
 * Repository: https://github.com/work2survive/AE_Get_Emojis
 * Live Demo:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Get_Emojis.jsx&autobuild=true
 * ============================================================================
 */

(function (thisObj) {
    var SCRIPT_TITLE = "AE Get Emojis v1.0";

    // =========================================================================
    // 1. ES3 / EXTENDSCRIPT SAFE JSON POLYFILL & STRING UTILITIES
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
                        pairs.push(JSONPolyfill.stringify(String(k)) + ":" + JSONPolyfill.stringify(obj[k]));
                    }
                }
                return "{" + pairs.join(",") + "}";
            }
            return "null";
        }
    };

    function trimStr(s) {
        if (s === null || typeof s === "undefined") return "";
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function padHex(hexStr, minLen) {
        var s = String(hexStr || "").toUpperCase();
        while (s.length < (minLen || 4)) s = "0" + s;
        return s;
    }

    function unicodeHexToInt(hexStr) {
        if (!hexStr) return 0;
        var clean = trimStr(hexStr).toUpperCase()
            .replace(/^U\+/i, "")
            .replace(/^0X/i, "")
            .split("-")[0];
        var val = parseInt(clean, 16);
        return isNaN(val) ? 0 : val;
    }

    function unicodeIntToHex(intVal) {
        var n = Math.max(0, Math.round(Number(intVal) || 0));
        return padHex(n.toString(16).toUpperCase(), 4);
    }

    function codePointToGlyph(codePoint) {
        var cp = Number(codePoint) || 0;
        if (cp <= 0) return "";
        try {
            if (typeof String.fromCodePoint === "function") {
                return String.fromCodePoint(cp);
            }
            if (cp <= 0xFFFF) {
                return String.fromCharCode(cp);
            }
            cp -= 0x10000;
            var high = 0xD800 + (cp >> 10);
            var low = 0xDC00 + (cp & 0x3FF);
            return String.fromCharCode(high, low);
        } catch (e) {
            return "";
        }
    }

    function glyphToCodePointInt(str) {
        var s = trimStr(str);
        if (!s) return 0;
        if (typeof s.codePointAt === "function") {
            return s.codePointAt(0) || 0;
        }
        var c0 = s.charCodeAt(0);
        if (c0 >= 0xD800 && c0 <= 0xDBFF && s.length > 1) {
            var c1 = s.charCodeAt(1);
            if (c1 >= 0xDC00 && c1 <= 0xDFFF) {
                return ((c0 - 0xD800) << 10) + (c1 - 0xDC00) + 0x10000;
            }
        }
        return c0;
    }

    function isBrowserSim() {
        return (typeof window !== "undefined" && typeof document !== "undefined");
    }

    // =========================================================================
    // 2. EMBEDDED FALLBACK DATABASE (Used if /emojis/*.json is offline/missing)
    // =========================================================================
    var FALLBACK_INDEX_DATA = {"version":"1.0.0","totalCount":48,"emojis":[{"index":1,"hexcode":"1F642","unicode":"U+1F642","unicodeInt":128578,"emoji":"🙂","name":"slightly smiling face","group":"smileys-emotion","subgroups":"face-smiling","tags":["face","happy","slightly","smile","smiling","satisfied"],"emoticons":[":-)",":)",":-]",":]",":->",":>","8-)","8)",":-}",":}",":o)",":c)",":^)","=]","=)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":2,"hexcode":"1F603","unicode":"U+1F603","unicodeInt":128515,"emoji":"😃","name":"grinning face with big eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["awesome","big","eyes","face","grin","grinning","happy","mouth","open","smile","smiling","teeth","yay"],"emoticons":[":-D",":D","8-D","8D","=D","=3","B^D","c:","C:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":3,"hexcode":"1F606","unicode":"U+1F606","unicodeInt":128518,"emoji":"😆","name":"grinning squinting face","group":"smileys-emotion","subgroups":"face-smiling","tags":["closed","eyes","face","grinning","haha","hahaha","happy","laugh","lol","mouth","open","rofl","smile","smiling","squinting"],"emoticons":["x-D","xD","X-D","XD"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":4,"hexcode":"1F604","unicode":"U+1F604","unicodeInt":128516,"emoji":"😄","name":"grinning face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["eye","eyes","face","grin","grinning","happy","laugh","lol","mouth","open","smile","smiling","teeth"],"emoticons":[":-))",":))"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":5,"hexcode":"1F601","unicode":"U+1F601","unicodeInt":128513,"emoji":"😁","name":"beaming face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["beaming","eye","eyes","face","grin","grinning","happy","nice","smile","smiling","teeth","mouth"],"emoticons":["^_^","^-^","^.^","(^_^)","(^-^)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":6,"hexcode":"1F602","unicode":"U+1F602","unicodeInt":128514,"emoji":"😂","name":"face with tears of joy","group":"smileys-emotion","subgroups":"face-smiling","tags":["crying","face","feels","funny","haha","happy","hehe","hilarious","joy","laugh","lmao","lol","rofl","roflmao","tear"],"emoticons":[":'-)",":')",":'D",":'-D",":\"D"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":7,"hexcode":"1F923","unicode":"U+1F923","unicodeInt":129315,"emoji":"🤣","name":"rolling on the floor laughing","group":"smileys-emotion","subgroups":"face-smiling","tags":["crying","face","floor","funny","haha","happy","hehe","hilarious","joy","laugh","lmao","lol","rofl","roflmao","rolling","tear","tears"],"emoticons":["ROFL","LMAO","XD!"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":8,"hexcode":"1F60A","unicode":"U+1F60A","unicodeInt":128522,"emoji":"😊","name":"smiling face with smiling eyes","group":"smileys-emotion","subgroups":"face-smiling","tags":["blush","eye","eyes","face","glad","satisfied","smile","smiling"],"emoticons":["(◕‿◕)","(｡◕‿◕｡)","^^","^o^"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":9,"hexcode":"1F607","unicode":"U+1F607","unicodeInt":128519,"emoji":"😇","name":"smiling face with halo","group":"smileys-emotion","subgroups":"face-smiling","tags":["angel","angelic","angels","blessed","face","fairy","fairytale","fantasy","halo","happy","innocent","peaceful","smile","smiling","spirit","tale"],"emoticons":["O:-)","O:)","0:-3","0:3","0:-)","0:)","0;^)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":10,"hexcode":"1F608","unicode":"U+1F608","unicodeInt":128520,"emoji":"😈","name":"smiling face with horns","group":"smileys-emotion","subgroups":"face-negative","tags":["demon","devil","evil","face","fairy","fairytale","fantasy","horns","purple","shade","smile","smiling","tale","malicious","sardonic"],"emoticons":[">:-)",">:)","}:-)","}:)","3:-)","3:)",">;-)",">;)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":11,"hexcode":"1F609","unicode":"U+1F609","unicodeInt":128521,"emoji":"😉","name":"winking face","group":"smileys-emotion","subgroups":"face-smiling","tags":["face","flirt","heartbreaker","sexy","slide","tease","wink","winking","winks","eye"],"emoticons":[";-)",";)","*-)","*)",";-]",";]",";^)",";>",":-,",";D",";3"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":12,"hexcode":"1F60D","unicode":"U+1F60D","unicodeInt":128525,"emoji":"😍","name":"smiling face with heart-eyes","group":"smileys-emotion","subgroups":"face-affection","tags":["143","bae","eye","face","feels","heart-eyes","hearts","ily","kisses","love","romance","romantic","smile","xoxo","happy"],"emoticons":["(♥_♥)","♥_♥","<3_<3","*❤️*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":13,"hexcode":"1F60E","unicode":"U+1F60E","unicodeInt":128526,"emoji":"😎","name":"smiling face with sunglasses","group":"smileys-emotion","subgroups":"face-glasses","tags":["awesome","beach","bright","bro","chilling","cool","face","rad","relaxed","shades","slay","smile","style","sunglasses","swag","win"],"emoticons":["B-)","B)","|;-)","8-)"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":14,"hexcode":"1F60F","unicode":"U+1F60F","unicodeInt":128527,"emoji":"😏","name":"smirking face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["boss","dapper","face","flirt","homie","kidding","leer","shade","slick","sly","smirk","smug","snicker","suave","suspicious","swag"],"emoticons":[":-J","( ͡° ͜ʖ ͡°)",";->"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":15,"hexcode":"1F610","unicode":"U+1F610","unicodeInt":128528,"emoji":"😐️","name":"neutral face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["awkward","blank","deadpan","expressionless","face","fine","jealous","meh","neutral","oh","shade","straight","unamused","unhappy","unimpressed","whatever","poker face"],"emoticons":[":-|",":|","._.","-_-"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":16,"hexcode":"1F612","unicode":"U+1F612","unicodeInt":128530,"emoji":"😒","name":"unamused face","group":"smileys-emotion","subgroups":"face-neutral-skeptical","tags":["...","bored","face","fine","jealous","jel","jelly","pissed","smh","ugh","uhh","unamused","unhappy","weird","whatever"],"emoticons":["ಠ_ಠ",">_>","<_<","¬_¬"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":17,"hexcode":"1F615","unicode":"U+1F615","unicodeInt":128533,"emoji":"😕","name":"confused face","group":"smileys-emotion","subgroups":"face-concerned","tags":["befuddled","confused","confusing","dunno","face","frown","hm","meh","not","sad","sorry","sure"],"emoticons":[":-/",":/",":-.",">:\\",">:/",":\\","=/","=\\",":L","=L"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":18,"hexcode":"1F618","unicode":"U+1F618","unicodeInt":128536,"emoji":"😘","name":"face blowing a kiss","group":"smileys-emotion","subgroups":"face-affection","tags":["adorbs","bae","blowing","face","flirt","heart","ily","kiss","love","lover","miss","muah","romantic","smooch","xoxo","you","happy"],"emoticons":[":-*",":*",":x","^3^","( ˘ ³˘)♥"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":19,"hexcode":"1F61B","unicode":"U+1F61B","unicodeInt":128539,"emoji":"😛","name":"face with tongue","group":"smileys-emotion","subgroups":"face-tongue","tags":["awesome","cool","face","nice","party","stuck-out","sweet","tongue"],"emoticons":[":-P",":P",":-p",":p",":-Þ",":Þ",":-þ",":þ",":-b",":b","d:","=p",">:P"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":20,"hexcode":"1F61C","unicode":"U+1F61C","unicodeInt":128540,"emoji":"😜","name":"winking face with tongue","group":"smileys-emotion","subgroups":"face-tongue","tags":["crazy","epic","eye","face","funny","joke","loopy","nutty","party","stuck-out","tongue","wacky","weirdo","wink","winking","yolo"],"emoticons":[";P",";-P",";p",";-p"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":21,"hexcode":"1F620","unicode":"U+1F620","unicodeInt":128544,"emoji":"😠","name":"angry face","group":"smileys-emotion","subgroups":"face-negative","tags":["anger","angry","blame","face","feels","frustrated","mad","maddening","rage","shade","unhappy","upset"],"emoticons":[">:(",">:-(",":@"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":22,"hexcode":"1F621","unicode":"U+1F621","unicodeInt":128545,"emoji":"😡","name":"enraged face","group":"smileys-emotion","subgroups":"face-negative","tags":["anger","angry","enraged","face","feels","mad","maddening","pouting","rage","red","shade","unhappy","upset"],"emoticons":["D:<","(╯°□°）╯︵ ┻━┻","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":23,"hexcode":"1F622","unicode":"U+1F622","unicodeInt":128546,"emoji":"😢","name":"crying face","group":"smileys-emotion","subgroups":"face-concerned","tags":["awful","cry","crying","face","feels","miss","sad","tear","triste","unhappy"],"emoticons":[":'-(",":'(",":=(",";("],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":24,"hexcode":"1F62D","unicode":"U+1F62D","unicodeInt":128557,"emoji":"😭","name":"loudly crying face","group":"smileys-emotion","subgroups":"face-concerned","tags":["bawling","cry","crying","face","loudly","sad","sob","tear","tears","unhappy"],"emoticons":["T_T","ToT","T-T",";_;","Q_Q","QQ","😭"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":25,"hexcode":"1F62E","unicode":"U+1F62E","unicodeInt":128558,"emoji":"😮","name":"face with open mouth","group":"smileys-emotion","subgroups":"face-concerned","tags":["believe","face","forgot","mouth","omg","open","shocked","surprised","sympathy","unbelievable","unreal","whoa","wow","you"],"emoticons":[":-O",":O",":-o",":o",":-0",":0","8-0",">:O","=O","=o","=0","O_O","o_o"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":26,"hexcode":"1F633","unicode":"U+1F633","unicodeInt":128563,"emoji":"😳","name":"flushed face","group":"smileys-emotion","subgroups":"face-concerned","tags":["amazed","awkward","crazy","dazed","dead","disbelief","embarrassed","face","flushed","geez","heat","hot","impressed","jeez","what","wow","red jaws"],"emoticons":[":$",":-$","😳"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":27,"hexcode":"1F634","unicode":"U+1F634","unicodeInt":128564,"emoji":"😴","name":"sleeping face","group":"smileys-emotion","subgroups":"face-sleepy","tags":["bed","bedtime","face","good","goodnight","nap","night","sleep","sleeping","tired","whatever","yawn","zzz"],"emoticons":["|-O","z_z","Z_Z","(-_-)zzz"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":28,"hexcode":"1F635","unicode":"U+1F635","unicodeInt":128565,"emoji":"😵","name":"face with crossed-out eyes","group":"smileys-emotion","subgroups":"face-unwell","tags":["crossed-out","dead","dizzy","eyes","face","feels","knocked","out","sick","tired","dead eyes"],"emoticons":["%-)","%)","#-)","x_x","X_X","+_+"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":29,"hexcode":"1F641","unicode":"U+1F641","unicodeInt":128577,"emoji":"🙁","name":"slightly frowning face","group":"smileys-emotion","subgroups":"face-concerned","tags":["face","frown","frowning","sad","slightly"],"emoticons":[":-(",":(",":-c",":c",":-<",":<",":-[",":[",":-||",":{"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":30,"hexcode":"1F63A","unicode":"U+1F63A","unicodeInt":128570,"emoji":"😺","name":"grinning cat","group":"smileys-emotion","subgroups":"cat-face","tags":["animal","cat","face","grinning","mouth","open","smile","smiling"],"emoticons":[":-3",":3","=3","x3","X3",">:3","uwu","UwU","owo","OwO"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":31,"hexcode":"1F929","unicode":"U+1F929","unicodeInt":129321,"emoji":"🤩","name":"star-struck","group":"smileys-emotion","subgroups":"face-affection","tags":["excited","eyes","face","grinning","smile","star","starry-eyed","wow","surprised"],"emoticons":["*_*","*o*","☆_☆"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":32,"hexcode":"1F914","unicode":"U+1F914","unicodeInt":129300,"emoji":"🤔","name":"thinking face","group":"smileys-emotion","subgroups":"face-hand","tags":["chin","consider","face","hmm","ponder","pondering","thinking","wondering","hand","overthinking","frown","curious"],"emoticons":[":thinking:",":?",":-?"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":33,"hexcode":"1F937","unicode":"U+1F937","unicodeInt":129335,"emoji":"🤷","name":"person shrugging","group":"people-body","subgroups":"person-gesture","tags":["doubt","dunno","guess","idk","ignorance","indifference","knows","maybe","person","shrug","shrugging","whatever","who","human","head","face"],"emoticons":["¯\\_(ツ)_/¯","¯\\(°_o)/¯"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":34,"hexcode":"1F64C","unicode":"U+1F64C","unicodeInt":128588,"emoji":"🙌","name":"raising hands","group":"people-body","subgroups":"hands","tags":["celebration","gesture","hand","hands","hooray","praise","raised","raising","raising hands","arms in the air","banzai","Festivus miracle","hallelujah","praise hands","two hands"],"emoticons":["\\o/","*\\0/*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":35,"hexcode":"1FAE1","unicode":"U+1FAE1","unicodeInt":129761,"emoji":"🫡","name":"saluting face","group":"smileys-emotion","subgroups":"face-hand","tags":["face","good","luck","ma’am","ok","respect","salute","saluting","sir","troops","yes"],"emoticons":["o7","<o/"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":36,"hexcode":"2764","unicode":"U+2764","unicodeInt":10084,"emoji":"❤️","name":"red heart","group":"smileys-emotion","subgroups":"heart","tags":["emotion","heart","love","red"],"emoticons":["<3","<33",":heart:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":37,"hexcode":"1F494","unicode":"U+1F494","unicodeInt":128148,"emoji":"💔","name":"broken heart","group":"smileys-emotion","subgroups":"heart","tags":["break","broken","crushed","emotion","heart","heartbroken","lonely","sad","heartbreak"],"emoticons":["</3","<\\3"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":38,"hexcode":"1F44D","unicode":"U+1F44D","unicodeInt":128077,"emoji":"👍️","name":"thumbs up","group":"people-body","subgroups":"hand-fingers-closed","tags":["+1","good","hand","like","thumb","up","yes","thumbs up"],"emoticons":["(y)","(Y)",":+1:",":thumbsup:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":39,"hexcode":"1F44E","unicode":"U+1F44E","unicodeInt":128078,"emoji":"👎️","name":"thumbs down","group":"people-body","subgroups":"hand-fingers-closed","tags":["-1","bad","dislike","down","good","hand","no","nope","thumb","thumbs","thumbs down","thumbs down sign"],"emoticons":["(n)","(N)",":-1:",":thumbsdown:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":40,"hexcode":"1F480","unicode":"U+1F480","unicodeInt":128128,"emoji":"💀","name":"skull","group":"smileys-emotion","subgroups":"face-negative","tags":["body","dead","death","face","fairy","fairytale","i’m","lmao","monster","tale","yolo","skull"],"emoticons":["8-X","8=X",":skull:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":41,"hexcode":"1F525","unicode":"U+1F525","unicodeInt":128293,"emoji":"🔥","name":"fire","group":"travel-places","subgroups":"sky-weather","tags":["af","burn","flame","hot","lit","litaf","tool","fire","high temperature","glow"],"emoticons":[":fire:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":42,"hexcode":"1F4AF","unicode":"U+1F4AF","unicodeInt":128175,"emoji":"💯","name":"hundred points","group":"smileys-emotion","subgroups":"emotion","tags":["100","a+","agree","clearly","definitely","faithful","fleek","full","hundred","keep","perfect","point","score","true","truth","yup","excellent"],"emoticons":[":100:","100%"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":43,"hexcode":"1F4A9","unicode":"U+1F4A9","unicodeInt":128169,"emoji":"💩","name":"pile of poo","group":"smileys-emotion","subgroups":"face-costume","tags":["bs","comic","doo","dung","face","fml","monster","pile","poo","poop","smelly","smh","stink","stinks","stinky","turd"],"emoticons":[":poop:",":hankey:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":44,"hexcode":"2728","unicode":"U+2728","unicodeInt":10024,"emoji":"✨️","name":"sparkles","group":"activities","subgroups":"event","tags":["*","magic","sparkle","star","beautiful"],"emoticons":[":sparkles:","*+*"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":45,"hexcode":"1F680","unicode":"U+1F680","unicodeInt":128640,"emoji":"🚀","name":"rocket","group":"travel-places","subgroups":"transport-air","tags":["launch","rockets","space","travel","rocket","galaxy","adventure","alien","transportation"],"emoticons":[":rocket:"],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":46,"hexcode":"2705","unicode":"U+2705","unicodeInt":9989,"emoji":"✅️","name":"check mark button","group":"symbols","subgroups":"other-symbol","tags":["button","check","checked","checkmark","complete","completed","done","fixed","mark","tick","✓","white","right","todo"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":47,"hexcode":"26A0","unicode":"U+26A0","unicodeInt":9888,"emoji":"⚠️","name":"warning","group":"symbols","subgroups":"warning","tags":["caution"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]},{"index":48,"hexcode":"1F389","unicode":"U+1F389","unicodeInt":127881,"emoji":"🎉","name":"party popper","group":"activities","subgroups":"event","tags":["awesome","birthday","celebrate","celebration","excited","hooray","party","popper","tada","woohoo","decoration","happy"],"emoticons":[],"sources":["openmoji_color","openmoji_flat","openmoji_black","twemoji_color"]}]};
    var FALLBACK_WIKI_DATA = {"source":"https://en.wikipedia.org/wiki/List_of_emoticons","description":"Mapping of Western sideways and Eastern kaomoji text emoticons to Unicode hexcode and integer codepoints.","lookup":{":-)":"1F642",":)":"1F642",":-]":"1F642",":]":"1F642",":->":"1F642",":>":"1F642","8-)":"1F60E","8)":"1F642",":-}":"1F642",":}":"1F642",":o)":"1F642",":c)":"1F642",":^)":"1F642","=]":"1F642","=)":"1F642",":-D":"1F603",":-d":"1F603",":D":"1F603",":d":"1F603","8-D":"1F603","8-d":"1F603","8D":"1F603","8d":"1F603","=D":"1F603","=d":"1F603","=3":"1F63A","B^D":"1F603","b^d":"1F603","c:":"1F603","C:":"1F603","x-D":"1F606","x-d":"1F606","xD":"1F606","xd":"1F606","X-D":"1F606","XD":"1F606",":-))":"1F604",":))":"1F604","^_^":"1F601","^-^":"1F601","^.^":"1F601","(^_^)":"1F601","(^-^)":"1F601",":'-)":"1F602",":')":"1F602",":'D":"1F602",":'d":"1F602",":'-D":"1F602",":'-d":"1F602",":\"D":"1F602",":\"d":"1F602","ROFL":"1F923","rofl":"1F923","LMAO":"1F923","lmao":"1F923","XD!":"1F923","xd!":"1F923","(◕‿◕)":"1F60A","(｡◕‿◕｡)":"1F60A","^^":"1F60A","^o^":"1F60A","O:-)":"1F607","o:-)":"1F607","O:)":"1F607","o:)":"1F607","0:-3":"1F607","0:3":"1F607","0:-)":"1F607","0:)":"1F607","0;^)":"1F607",">:-)":"1F608",">:)":"1F608","}:-)":"1F608","}:)":"1F608","3:-)":"1F608","3:)":"1F608",">;-)":"1F608",">;)":"1F608",";-)":"1F609",";)":"1F609","*-)":"1F609","*)":"1F609",";-]":"1F609",";]":"1F609",";^)":"1F609",";>":"1F609",":-,":"1F609",";D":"1F609",";d":"1F609",";3":"1F609",":-9":"1F60B",":9":"1F60B","(♥_♥)":"1F60D","♥_♥":"1F60D","<3_<3":"1F60D","*❤️*":"1F60D","B-)":"1F60E","b-)":"1F60E","B)":"1F60E","b)":"1F60E","|;-)":"1F60E",":-J":"1F60F",":-j":"1F60F","( ͡° ͜ʖ ͡°)":"1F60F",";->":"1F60F",":-|":"1F610",":|":"1F610","._.":"1F610","-_-":"1F610","=_=":"1F611","-_-;":"1F611","u_u":"1F611","~_~":"1F611","ಠ_ಠ":"1F612",">_>":"1F612","<_<":"1F612","¬_¬":"1F612",":-/":"1F615",":/":"1F615",":-.":"1F615",">:\\":"1F615",">:/":"1F615",":\\":"1F615","=/":"1F615","=\\":"1F615",":L":"1F615",":l":"1F615","=L":"1F615","=l":"1F615",":S":"1F616",":s":"1F616",":-S":"1F616",":-s":"1F616",">_<":"1F616",">.<":"1F616",":-*":"1F618",":*":"1F618",":x":"1F636","^3^":"1F618","( ˘ ³˘)♥":"1F618",":-P":"1F61B",":-p":"1F61B",":P":"1F61B",":p":"1F61B",":-Þ":"1F61B",":-þ":"1F61B",":Þ":"1F61B",":þ":"1F61B",":-b":"1F61B",":b":"1F61B","d:":"1F626","=p":"1F61B",">:P":"1F61B",">:p":"1F61B",";P":"1F61C",";p":"1F61C",";-P":"1F61C",";-p":"1F61C","X-P":"1F61D","x-p":"1F61D","XP":"1F61D","xp":"1F61D","v.v":"1F61E","v_v":"1F61E","._.;":"1F61E",">:(":"1F620",">:-(":"1F620",":@":"1F620","D:<":"1F621","d:<":"1F621","(╯°□°）╯︵ ┻━┻":"1F621","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻":"1F621","┻━┻ ︵ヽ(`д´)ﾉ︵ ┻━┻":"1F621",":'-(":"1F622",":'(":"1F622",":=(":"1F622",";(":"1F622","T_T":"1F62D","t_t":"1F62D","ToT":"1F62D","tot":"1F62D","T-T":"1F62D","t-t":"1F62D",";_;":"1F62D","Q_Q":"1F62D","q_q":"1F62D","QQ":"1F62D","qq":"1F62D","😭":"1F62D","D:":"1F626","D=":"1F626","d=":"1F626","D;":"1F626","d;":"1F626","D-':":"1F628","d-':":"1F628","D8":"1F628","d8":"1F628","DX":"1F628","dx":"1F628",":-O":"1F62E",":-o":"1F62E",":O":"1F62E",":o":"1F62E",":-0":"1F62E",":0":"1F62E","8-0":"1F62E",">:O":"1F62E",">:o":"1F62E","=O":"1F62E","=o":"1F62E","=0":"1F62E","O_O":"1F62E","o_o":"1F632","0_0":"1F632","O.O":"1F632","o.o":"1F632","o_O":"1F632","O_o":"1F632",":$":"1F633",":-$":"1F633","😳":"1F633","|-O":"1F634","|-o":"1F634","z_z":"1F634","Z_Z":"1F634","(-_-)zzz":"1F634","%-)":"1F635","%)":"1F635","#-)":"1F635","x_x":"1F635","X_X":"1F635","+_+":"1F635",":-X":"1F636",":-x":"1F636",":X":"1F636",":-#":"1F636",":#":"1F636",":-&":"1F636",":&":"1F636",":-Z":"1F910",":-z":"1F910",":Z":"1F910",":z":"1F910",":-(":"1F641",":(":"1F641",":-c":"1F641",":c":"1F641",":-<":"1F641",":<":"1F641",":-[":"1F641",":[":"1F641",":-||":"1F641",":{":"1F641",":-3":"1F63A",":3":"1F63A","x3":"1F63A","X3":"1F63A",">:3":"1F63A","uwu":"1F63A","UwU":"1F63A","owo":"1F63A","OwO":"1F63A","$_$":"1F911","($.$)":"1F911","*_*":"1F929","*o*":"1F929","☆_☆":"1F929","',:-I":"1F928","',:-i":"1F928","',:-l":"1F928","🤨":"1F928",":thinking:":"1F914",":?":"1F914",":-?":"1F914","(づ｡◕‿‿◕｡)づ":"1F917","༼ つ ◕_◕ ༽つ":"1F917","¯\\_(ツ)_/¯":"1F937","¯\\(°_o)/¯":"1F937","\\o/":"1F64C","*\\0/*":"1F64C","o7":"1FAE1","<o/":"1FAE1","<3":"2764","<33":"2764",":heart:":"2764","</3":"1F494","<\\3":"1F494","@};-":"1F339","@}->--":"1F339","@}-;-'---":"1F339","@>-->--":"1F339","\\m/":"1F918","\\,,/":"1F918","(y)":"1F44D","(Y)":"1F44D",":+1:":"1F44D",":thumbsup:":"1F44D","(n)":"1F44E","(N)":"1F44E",":-1:":"1F44E",":thumbsdown:":"1F44E","><>":"1F41F","<><":"1F41F","<*)))>-{":"1F41F","*<|:-)":"1F385","c[_]":"2615","c\\_/":"2615","ʕ•ᴥ•ʔ":"1F43B","⊂(￣(ｴ)￣)⊃":"1F43B","8-X":"1F480","8-x":"1F480","8=X":"1F480","8=x":"1F480",":skull:":"1F480",":fire:":"1F525",":100:":"1F4AF","100%":"1F4AF",":poop:":"1F4A9",":hankey:":"1F4A9",":sparkles:":"2728","*+*":"2728",":rocket:":"1F680"},"entries":[{"hexcode":"1F642","unicode":"U+1F642","unicodeInt":128578,"emoji":"🙂","meaning":"Smiley, happy face","section":"Western (Sideways)","emoticons":[":-)",":)",":-]",":]",":->",":>","8-)","8)",":-}",":}",":o)",":c)",":^)","=]","=)"]},{"hexcode":"1F603","unicode":"U+1F603","unicodeInt":128515,"emoji":"😃","meaning":"Laughing, big grin, grinning with big eyes","section":"Western (Sideways)","emoticons":[":-D",":D","8-D","8D","=D","=3","B^D","c:","C:"]},{"hexcode":"1F606","unicode":"U+1F606","unicodeInt":128518,"emoji":"😆","meaning":"Laughing, big grin with squinting eyes","section":"Western (Sideways)","emoticons":["x-D","xD","X-D","XD"]},{"hexcode":"1F604","unicode":"U+1F604","unicodeInt":128516,"emoji":"😄","meaning":"Very happy, double chin grin","section":"Western (Sideways)","emoticons":[":-))",":))"]},{"hexcode":"1F601","unicode":"U+1F601","unicodeInt":128513,"emoji":"😁","meaning":"Beaming face with smiling eyes","section":"Eastern / Kaomoji","emoticons":["^_^","^-^","^.^","(^_^)","(^-^)"]},{"hexcode":"1F602","unicode":"U+1F602","unicodeInt":128514,"emoji":"😂","meaning":"Face with tears of joy","section":"Western (Sideways)","emoticons":[":'-)",":')",":'D",":'-D",":\"D"]},{"hexcode":"1F923","unicode":"U+1F923","unicodeInt":129315,"emoji":"🤣","meaning":"Rolling on the floor laughing (ROFL)","section":"Western (Sideways)","emoticons":["ROFL","LMAO","XD!"]},{"hexcode":"1F60A","unicode":"U+1F60A","unicodeInt":128522,"emoji":"😊","meaning":"Smiling face with smiling eyes / blush","section":"Eastern / Kaomoji","emoticons":["(◕‿◕)","(｡◕‿◕｡)","^^","^o^"]},{"hexcode":"1F607","unicode":"U+1F607","unicodeInt":128519,"emoji":"😇","meaning":"Angel, saint, innocent halo","section":"Western (Sideways)","emoticons":["O:-)","O:)","0:-3","0:3","0:-)","0:)","0;^)"]},{"hexcode":"1F608","unicode":"U+1F608","unicodeInt":128520,"emoji":"😈","meaning":"Evil, devilish grin with horns","section":"Western (Sideways)","emoticons":[">:-)",">:)","}:-)","}:)","3:-)","3:)",">;-)",">;)"]},{"hexcode":"1F609","unicode":"U+1F609","unicodeInt":128521,"emoji":"😉","meaning":"Wink, smirk","section":"Western (Sideways)","emoticons":[";-)",";)","*-)","*)",";-]",";]",";^)",";>",":-,",";D",";3"]},{"hexcode":"1F60B","unicode":"U+1F60B","unicodeInt":128523,"emoji":"😋","meaning":"Face savoring food, yummy","section":"Western (Sideways)","emoticons":[":-9",":9"]},{"hexcode":"1F60D","unicode":"U+1F60D","unicodeInt":128525,"emoji":"😍","meaning":"Smiling face with heart-eyes, infatuation","section":"Eastern / Kaomoji","emoticons":["(♥_♥)","♥_♥","<3_<3","*❤️*"]},{"hexcode":"1F60E","unicode":"U+1F60E","unicodeInt":128526,"emoji":"😎","meaning":"Cool, sunglasses, shades","section":"Western (Sideways)","emoticons":["B-)","B)","|;-)","8-)"]},{"hexcode":"1F60F","unicode":"U+1F60F","unicodeInt":128527,"emoji":"😏","meaning":"Smirking, sly, Lenny face","section":"Western / Kaomoji","emoticons":[":-J","( ͡° ͜ʖ ͡°)",";->"]},{"hexcode":"1F610","unicode":"U+1F610","unicodeInt":128528,"emoji":"😐","meaning":"Straight face, no expression, indecision","section":"Western (Sideways)","emoticons":[":-|",":|","._.","-_-"]},{"hexcode":"1F611","unicode":"U+1F611","unicodeInt":128529,"emoji":"😑","meaning":"Expressionless, tired, unimpressed","section":"Eastern / Kaomoji","emoticons":["=_=","-_-;","u_u","~_~"]},{"hexcode":"1F612","unicode":"U+1F612","unicodeInt":128530,"emoji":"😒","meaning":"Unamused, skeptical, side-eye, look of disapproval","section":"Eastern / Kaomoji","emoticons":["ಠ_ಠ",">_>","<_<","¬_¬"]},{"hexcode":"1F615","unicode":"U+1F615","unicodeInt":128533,"emoji":"😕","meaning":"Skeptical, annoyed, undecided, uneasy, hesitant","section":"Western (Sideways)","emoticons":[":-/",":/",":-.",">:\\",">:/",":\\","=/","=\\",":L","=L"]},{"hexcode":"1F616","unicode":"U+1F616","unicodeInt":128534,"emoji":"😖","meaning":"Confounded, scrunched face, cringed","section":"Western / Kaomoji","emoticons":[":S",":-S",">_<",">.<"]},{"hexcode":"1F618","unicode":"U+1F618","unicodeInt":128536,"emoji":"😘","meaning":"Face blowing a kiss","section":"Western (Sideways)","emoticons":[":-*",":*",":x","^3^","( ˘ ³˘)♥"]},{"hexcode":"1F61B","unicode":"U+1F61B","unicodeInt":128539,"emoji":"😛","meaning":"Tongue sticking out, cheeky, playful","section":"Western (Sideways)","emoticons":[":-P",":P",":-p",":p",":-Þ",":Þ",":-þ",":þ",":-b",":b","d:","=p",">:P"]},{"hexcode":"1F61C","unicode":"U+1F61C","unicodeInt":128540,"emoji":"😜","meaning":"Winking face with tongue","section":"Western (Sideways)","emoticons":[";P",";-P",";p",";-p"]},{"hexcode":"1F61D","unicode":"U+1F61D","unicodeInt":128541,"emoji":"😝","meaning":"Squinting face with tongue, playful","section":"Western (Sideways)","emoticons":["X-P","XP","x-p","xp"]},{"hexcode":"1F61E","unicode":"U+1F61E","unicodeInt":128542,"emoji":"😞","meaning":"Disappointed, sad, dejected","section":"Eastern / Kaomoji","emoticons":["v.v","v_v","._.;"]},{"hexcode":"1F620","unicode":"U+1F620","unicodeInt":128544,"emoji":"😠","meaning":"Angry face","section":"Western (Sideways)","emoticons":[">:(",">:-(",":@"]},{"hexcode":"1F621","unicode":"U+1F621","unicodeInt":128545,"emoji":"😡","meaning":"Pouting, very angry, rage, table flip","section":"Western / Kaomoji","emoticons":["D:<","(╯°□°）╯︵ ┻━┻","┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻"]},{"hexcode":"1F622","unicode":"U+1F622","unicodeInt":128546,"emoji":"😢","meaning":"Crying face, single tear","section":"Western (Sideways)","emoticons":[":'-(",":'(",":=(",";("]},{"hexcode":"1F62D","unicode":"U+1F62D","unicodeInt":128557,"emoji":"😭","meaning":"Loudly crying face, bawling","section":"Eastern / Kaomoji","emoticons":["T_T","ToT","T-T",";_;","Q_Q","QQ","😭"]},{"hexcode":"1F626","unicode":"U+1F626","unicodeInt":128550,"emoji":"😦","meaning":"Frowning with open mouth, dismay","section":"Western (Sideways)","emoticons":["D:","D=","D;"]},{"hexcode":"1F628","unicode":"U+1F628","unicodeInt":128552,"emoji":"😨","meaning":"Fearful, horror, shock","section":"Western (Sideways)","emoticons":["D-':","D8","DX"]},{"hexcode":"1F62E","unicode":"U+1F62E","unicodeInt":128558,"emoji":"😮","meaning":"Surprise, shock, open mouth","section":"Western (Sideways)","emoticons":[":-O",":O",":-o",":o",":-0",":0","8-0",">:O","=O","=o","=0","O_O","o_o"]},{"hexcode":"1F632","unicode":"U+1F632","unicodeInt":128562,"emoji":"😲","meaning":"Astonished, gasping in shock","section":"Eastern / Kaomoji","emoticons":["0_0","O.O","o_O","O_o"]},{"hexcode":"1F633","unicode":"U+1F633","unicodeInt":128563,"emoji":"😳","meaning":"Flushed, embarrassed, blushing","section":"Western (Sideways)","emoticons":[":$",":-$","😳"]},{"hexcode":"1F634","unicode":"U+1F634","unicodeInt":128564,"emoji":"😴","meaning":"Sleeping, bored, yawn","section":"Western / Kaomoji","emoticons":["|-O","z_z","Z_Z","(-_-)zzz"]},{"hexcode":"1F635","unicode":"U+1F635","unicodeInt":128565,"emoji":"😵","meaning":"Dizzy, knocked out, dead eyes","section":"Western / Kaomoji","emoticons":["%-)","%)","#-)","x_x","X_X","+_+"]},{"hexcode":"1F636","unicode":"U+1F636","unicodeInt":128566,"emoji":"😶","meaning":"Face without mouth, speechless","section":"Western (Sideways)","emoticons":[":-X",":X",":-#",":#",":-&",":&"]},{"hexcode":"1F910","unicode":"U+1F910","unicodeInt":129296,"emoji":"🤐","meaning":"Zipper-mouth face, sealed lips","section":"Western (Sideways)","emoticons":[":-Z",":Z"]},{"hexcode":"1F641","unicode":"U+1F641","unicodeInt":128577,"emoji":"🙁","meaning":"Frowning, sad, pouting","section":"Western (Sideways)","emoticons":[":-(",":(",":-c",":c",":-<",":<",":-[",":[",":-||",":{"]},{"hexcode":"1F63A","unicode":"U+1F63A","unicodeInt":128570,"emoji":"😺","meaning":"Grinning cat, curly mouth / cat smile","section":"Western / Kaomoji","emoticons":[":-3",":3","=3","x3","X3",">:3","uwu","UwU","owo","OwO"]},{"hexcode":"1F911","unicode":"U+1F911","unicodeInt":129297,"emoji":"🤑","meaning":"Money-mouth face","section":"Eastern / Kaomoji","emoticons":["$_$","($.$)"]},{"hexcode":"1F929","unicode":"U+1F929","unicodeInt":129321,"emoji":"🤩","meaning":"Star-struck, amazed","section":"Eastern / Kaomoji","emoticons":["*_*","*o*","☆_☆"]},{"hexcode":"1F928","unicode":"U+1F928","unicodeInt":129320,"emoji":"🤨","meaning":"Face with raised eyebrow, skeptical","section":"Western (Sideways)","emoticons":["',:-I","',:-l","🤨"]},{"hexcode":"1F914","unicode":"U+1F914","unicodeInt":129300,"emoji":"🤔","meaning":"Thinking face, pondering","section":"Western (Sideways)","emoticons":[":thinking:",":?",":-?"]},{"hexcode":"1F917","unicode":"U+1F917","unicodeInt":129303,"emoji":"🤗","meaning":"Smiling face with open hands, hug","section":"Eastern / Kaomoji","emoticons":["(づ｡◕‿‿◕｡)づ","༼ つ ◕_◕ ༽つ"]},{"hexcode":"1F937","unicode":"U+1F937","unicodeInt":129335,"emoji":"🤷","meaning":"Person shrugging","section":"Eastern / Kaomoji","emoticons":["¯\\_(ツ)_/¯","¯\\(°_o)/¯"]},{"hexcode":"1F64C","unicode":"U+1F64C","unicodeInt":128588,"emoji":"🙌","meaning":"Raising hands, cheer, yay","section":"Western (Posture)","emoticons":["\\o/","*\\0/*"]},{"hexcode":"1FAE1","unicode":"U+1FAE1","unicodeInt":129761,"emoji":"🫡","meaning":"Saluting face / salute","section":"Western (Posture)","emoticons":["o7","<o/"]},{"hexcode":"2764","unicode":"U+2764","unicodeInt":10084,"emoji":"❤","meaning":"Red heart, love","section":"Western (Symbols)","emoticons":["<3","<33",":heart:"]},{"hexcode":"1F494","unicode":"U+1F494","unicodeInt":128148,"emoji":"💔","meaning":"Broken heart","section":"Western (Symbols)","emoticons":["</3","<\\3"]},{"hexcode":"1F339","unicode":"U+1F339","unicodeInt":127801,"emoji":"🌹","meaning":"Single rose","section":"Western (Symbols)","emoticons":["@};-","@}->--","@}-;-'---","@>-->--"]},{"hexcode":"1F918","unicode":"U+1F918","unicodeInt":129304,"emoji":"🤘","meaning":"Sign of the horns, rock on","section":"Western (Symbols)","emoticons":["\\m/","\\,,/"]},{"hexcode":"1F44D","unicode":"U+1F44D","unicodeInt":128077,"emoji":"👍","meaning":"Thumbs up, approve","section":"Western (Symbols)","emoticons":["(y)","(Y)",":+1:",":thumbsup:"]},{"hexcode":"1F44E","unicode":"U+1F44E","unicodeInt":128078,"emoji":"👎","meaning":"Thumbs down, disapprove","section":"Western (Symbols)","emoticons":["(n)","(N)",":-1:",":thumbsdown:"]},{"hexcode":"1F41F","unicode":"U+1F41F","unicodeInt":128031,"emoji":"🐟","meaning":"Fish","section":"Western (Symbols)","emoticons":["><>","<><","<*)))>-{"]},{"hexcode":"1F385","unicode":"U+1F385","unicodeInt":127877,"emoji":"🎅","meaning":"Santa Claus","section":"Western (Sideways)","emoticons":["*<|:-)"]},{"hexcode":"2615","unicode":"U+2615","unicodeInt":9749,"emoji":"☕","meaning":"Hot beverage, coffee mug","section":"Western (Symbols)","emoticons":["c[_]","c\\_/"]},{"hexcode":"1F43B","unicode":"U+1F43B","unicodeInt":128059,"emoji":"🐻","meaning":"Bear face","section":"Eastern / Kaomoji","emoticons":["ʕ•ᴥ•ʔ","⊂(￣(ｴ)￣)⊃"]},{"hexcode":"1F480","unicode":"U+1F480","unicodeInt":128128,"emoji":"💀","meaning":"Skull, dead","section":"Western (Sideways)","emoticons":["8-X","8=X",":skull:"]},{"hexcode":"1F525","unicode":"U+1F525","unicodeInt":128293,"emoji":"🔥","meaning":"Fire, lit","section":"Shortcodes","emoticons":[":fire:"]},{"hexcode":"1F4AF","unicode":"U+1F4AF","unicodeInt":128175,"emoji":"💯","meaning":"Hundred points, 100%","section":"Shortcodes","emoticons":[":100:","100%"]},{"hexcode":"1F4A9","unicode":"U+1F4A9","unicodeInt":128169,"emoji":"💩","meaning":"Pile of poo","section":"Shortcodes","emoticons":[":poop:",":hankey:"]},{"hexcode":"2728","unicode":"U+2728","unicodeInt":10024,"emoji":"✨","meaning":"Sparkles","section":"Shortcodes","emoticons":[":sparkles:","*+*"]},{"hexcode":"1F680","unicode":"U+1F680","unicodeInt":128640,"emoji":"🚀","meaning":"Rocket","section":"Shortcodes","emoticons":[":rocket:"]}]};
    var FALLBACK_SHAPES_DATA = {"1F642":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.81,8.93],[0.0,11.5],[-9.81,8.93]],"i":[[0.0,0.0],[3.57,0.0],[2.9,1.64]],"o":[[-2.9,1.64],[-3.57,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F603":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.43,-10.59],[-4.43,-5.18],[-7.43,0.22],[-10.43,-5.18]],"i":[[-1.66,0.0],[0.0,-2.98],[1.66,0.0],[0.0,2.98]],"o":[[1.66,0.0],[0.0,2.98],[-1.66,0.0],[0.0,-2.98]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[7.43,-10.58],[10.43,-5.18],[7.43,0.23],[4.43,-5.18]],"i":[[-1.66,0.0],[0.0,-2.98],[1.66,0.0],[0.0,2.98]],"o":[[1.66,0.0],[0.0,2.98],[-1.66,0.0],[0.0,-2.98]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F606":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-10.83,-8.59],[-4.25,-4.57],[-10.83,-0.84]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.83,-8.59],[4.24,-4.57],[10.83,-0.84]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F604":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-3.6],[-8.62,-6.4],[-12.94,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-3.6],[8.62,-6.4],[4.31,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F601":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-3.6],[-8.62,-6.4],[-12.94,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-3.6],[8.62,-6.4],[4.31,-3.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F602":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[29.76,11.34],[26.76,12.58],[23.76,11.34],[20.75,2.32],[29.76,5.34],[31.0,8.34]],"i":[[0.8,-0.8],[1.13,-0.0],[0.8,0.8],[0.0,0.06],[-2.96,-2.96],[0.0,-1.13]],"o":[[-0.8,0.8],[-1.13,0.0],[-2.97,-2.97],[0.23,0.01],[0.8,0.8],[0.0,1.13]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[-29.76,11.34],[-31.0,8.34],[-29.76,5.34],[-20.74,2.33],[-23.76,11.34],[-26.76,12.58]],"i":[[0.8,0.8],[0.0,1.13],[-0.8,0.8],[-0.06,0.0],[2.96,-2.96],[1.13,0.0]],"o":[[-0.8,-0.8],[-0.0,-1.13],[2.97,-2.97],[-0.01,0.23],[-0.8,0.8],[-1.13,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[22.85,-2.66],[22.83,-2.83],[0.13,-23.0],[-22.8,-3.08],[-22.85,-2.66]],"i":[[0.0,0.0],[0.01,0.06],[11.56,0.06],[1.55,-11.46],[0.01,-0.11]],"o":[[-0.01,-0.06],[-1.42,-11.47],[-11.56,-0.06],[-0.01,0.11],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.82,13.23],[0.0,23.0],[18.76,13.31]],"i":[[0.0,0.0],[-7.47,-0.09],[-4.35,6.03]],"o":[[4.37,6.06],[7.44,-0.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.31,-7.8],[-11.91,-10.8],[-7.38,-11.22]],"i":[[0.0,0.0],[-1.46,0.55],[-1.51,-0.43]],"o":[[0.72,-1.39],[1.4,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.31,-7.8],[7.4,-11.23]],"i":[[0.0,0.0],[3.11,-0.74]],"o":[[-1.58,-2.77],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.59,5.64],[13.72,10.13],[-13.77,10.0],[-14.59,5.64],[-14.48,5.64],[14.41,5.71]],"i":[[0.0,0.0],[0.59,-1.42],[2.06,0.47],[-0.01,1.49],[0.0,0.0],[-14.09,3.52]],"o":[[0.01,1.54],[-12.49,3.03],[-0.56,-1.39],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.73,10.13],[0.04,17.36],[-13.76,10.0]],"i":[[-12.49,3.03],[7.34,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.06,0.47]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[29.76,11.34],[26.76,12.58],[23.76,11.34],[20.75,2.32],[29.76,5.34],[31.0,8.34]],"i":[[0.8,-0.8],[1.13,-0.0],[0.8,0.8],[0.0,0.06],[-2.96,-2.96],[0.0,-1.13]],"o":[[-0.8,0.8],[-1.13,0.0],[-2.97,-2.97],[0.23,0.01],[0.8,0.8],[0.0,1.13]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-29.76,11.34],[-31.0,8.34],[-29.76,5.34],[-20.74,2.33],[-23.76,11.34],[-26.76,12.58]],"i":[[0.8,0.8],[0.0,1.13],[-0.8,0.8],[-0.06,0.0],[2.96,-2.96],[1.13,0.0]],"o":[[-0.8,-0.8],[-0.0,-1.13],[2.97,-2.97],[-0.01,0.23],[-0.8,0.8],[-1.13,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-4.31,-0.84],[-8.62,-3.64],[-12.94,-0.84]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-0.84],[8.62,-3.64],[4.31,-0.84]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F923":[{"v":[[-0.0,-24.0],[24.0,-0.0],[-0.0,24.0],[-24.0,-0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[15.58,-1.45],[16.8,2.96],[-7.88,15.08],[-10.56,11.55],[-10.46,11.5],[15.44,-1.3]],"i":[[0.0,0.0],[-0.11,-1.54],[2.05,-0.5],[0.66,1.34],[0.0,0.0],[-11.05,9.42]],"o":[[0.7,1.37],[-9.84,8.27],[-1.12,-0.99],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[16.8,2.96],[7.76,15.53],[-7.88,15.08]],"i":[[-9.84,8.27],[6.57,-3.27],[3.51,3.09]],"o":[[0.3,4.62],[-6.64,3.3],[2.05,-0.5]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[31.69,-3.09],[29.56,-0.64],[26.32,-0.42],[19.61,-7.16],[29.02,-8.46],[31.47,-6.33]],"i":[[0.36,-1.07],[1.01,-0.5],[1.07,0.36],[0.03,0.05],[-3.96,-1.33],[-0.5,-1.01]],"o":[[-0.36,1.07],[-1.01,0.5],[-3.98,-1.34],[0.21,-0.09],[1.07,0.36],[0.5,1.01]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[-21.61,23.4],[-24.05,21.26],[-24.28,18.02],[-17.54,11.32],[-16.23,20.73],[-18.36,23.18]],"i":[[1.07,0.36],[0.5,1.01],[-0.36,1.07],[-0.05,0.03],[1.33,-3.96],[1.01,-0.5]],"o":[[-1.07,-0.36],[-0.5,-1.01],[1.34,-3.98],[0.09,0.21],[-0.36,1.07],[-1.01,0.5]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[19.28,-12.55],[19.18,-12.69],[-10.12,-20.65],[-21.78,7.39],[-21.64,7.79]],"i":[[0.0,0.0],[0.03,0.05],[10.38,-5.09],[-3.71,-10.95],[-0.04,-0.1]],"o":[[-0.03,-0.05],[-6.38,-9.64],[-10.38,5.09],[0.03,0.1],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.96,20.22],[10.24,20.6],[22.72,3.57]],"i":[[0.0,0.0],[-6.73,3.25],[-1.21,7.34]],"o":[[6.61,3.48],[6.64,-3.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.58,-1.45],[16.8,2.96],[-7.88,15.08],[-10.56,11.55],[-10.46,11.5],[15.44,-1.3]],"i":[[0.0,0.0],[-0.11,-1.54],[2.05,-0.5],[0.66,1.34],[0.0,0.0],[-11.05,9.42]],"o":[[0.7,1.37],[-9.84,8.27],[-1.12,-0.99],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.8,2.96],[7.76,15.53],[-7.88,15.08]],"i":[[-9.84,8.27],[6.57,-3.27],[3.51,3.09]],"o":[[0.3,4.62],[-6.64,3.3],[2.05,-0.5]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[31.69,-3.09],[29.56,-0.64],[26.32,-0.42],[19.61,-7.16],[29.02,-8.46],[31.47,-6.33]],"i":[[0.36,-1.07],[1.01,-0.5],[1.07,0.36],[0.03,0.05],[-3.96,-1.33],[-0.5,-1.01]],"o":[[-0.36,1.07],[-1.01,0.5],[-3.98,-1.34],[0.21,-0.09],[1.07,0.36],[0.5,1.01]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-21.61,23.4],[-24.05,21.26],[-24.28,18.02],[-17.54,11.32],[-16.23,20.73],[-18.36,23.18]],"i":[[1.07,0.36],[0.5,1.01],[-0.36,1.07],[-0.05,0.03],[1.33,-3.96],[1.01,-0.5]],"o":[[-1.07,-0.36],[-0.5,-1.01],[1.34,-3.98],[0.09,0.21],[-0.36,1.07],[-1.01,0.5]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-13.52,-2.87],[-5.84,-2.21],[-10.07,4.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.88,-12.51],[1.77,-5.99],[9.33,-5.57]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60A":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.81,9.23],[-9.81,9.23]],"i":[[0.0,0.0],[5.7,4.7]],"o":[[-5.7,4.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.31,-2.6],[-8.62,-5.4],[-12.94,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-2.6],[8.62,-5.4],[4.31,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1}],"1F607":[{"v":[[0.0,24.0],[21.83,9.98],[18.16,-15.7],[17.89,-16.0],[-11.22,-21.22],[-23.29,5.78]],"i":[[-11.03,-0.0],[-3.91,8.54],[6.14,7.1],[0.09,0.1],[9.75,-5.15],[-2.66,-10.7]],"o":[[9.39,0.0],[3.91,-8.54],[-0.09,-0.1],[-7.35,-8.22],[-9.75,5.15],[2.66,10.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[9.81,9.23],[-9.81,9.23]],"i":[[0.0,0.0],[5.7,4.7]],"o":[[-5.7,4.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.77,-19.77],[-11.6,-19.86]],"i":[[0.0,0.0],[7.23,-4.22]],"o":[[-7.19,-4.28],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.36,-13.85],[-15.45,17.03],[15.57,16.92],[18.26,-13.98]],"i":[[0.0,0.0],[-8.81,-7.99],[-8.76,8.06],[7.23,9.45]],"o":[[-7.17,9.5],[8.81,7.99],[8.76,-8.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-26.45],[25.0,-21.2],[0.0,-15.95],[-25.0,-21.2]],"i":[[-13.81,0.0],[0.0,-2.9],[13.81,0.0],[0.0,2.9]],"o":[[13.81,0.0],[0.0,2.9],[-13.81,0.0],[0.0,-2.9]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-4.31,-2.6],[-8.62,-5.4],[-12.94,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[12.94,-2.6],[8.62,-5.4],[4.31,-2.6]],"i":[[0.0,0.0],[1.87,0.0],[0.76,-1.71]],"o":[[-0.76,-1.71],[-1.87,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"l":1},{"v":[[0.0,-26.45],[25.0,-21.2],[0.0,-15.95],[-25.0,-21.2]],"i":[[-13.81,0.0],[0.0,-2.9],[13.81,0.0],[0.0,2.9]],"o":[[13.81,0.0],[0.0,2.9],[-13.81,0.0],[0.0,-2.9]],"c":true,"s":[0.3804,0.698,0.8941],"sw":2.1}],"1F608":[{"v":[[12.86,-20.0],[15.86,-29.0],[18.86,-14.0]],"i":[[0.0,0.0],[1.0,4.0],[3.0,-5.0]],"o":[[3.0,-2.0],[7.0,2.0],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[-12.86,-20.0],[-15.86,-29.0],[-18.86,-14.0]],"i":[[0.0,0.0],[-1.0,4.0],[-3.0,-5.0]],"o":[[-3.0,-2.0],[-7.0,2.0],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-11.0],[-6.0,-7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-11.0],[6.0,-7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[12.86,-20.0],[15.86,-29.0],[18.86,-14.0]],"i":[[0.0,0.0],[1.0,4.0],[3.0,-5.0]],"o":[[3.0,-2.0],[7.0,2.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.86,-20.0],[-15.86,-29.0],[-18.86,-14.0]],"i":[[0.0,0.0],[-1.0,4.0],[-3.0,-5.0]],"o":[[-3.0,-2.0],[-7.0,2.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,7.0],[-0.34,8.0],[-6.5,7.0]],"i":[[0.0,0.0],[2.86,0.03],[1.17,0.58]],"o":[[-1.28,0.64],[-2.62,-0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F609":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[2.25,15.02],[5.28,13.68],[6.45,12.23],[6.76,10.62],[3.06,10.67],[-6.9,10.67],[-5.59,13.68],[-2.43,15.02]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-15.35,-5.97],[-12.69,-9.61],[-8.37,-10.99]],"i":[[0.0,0.0],[-1.31,0.84],[-1.56,-0.1]],"o":[[0.41,-1.5],[1.22,-0.98],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.0,-4.91],[6.49,-6.08]],"i":[[0.0,0.0],[2.78,-1.54]],"o":[[-2.26,-2.24],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.78,9.77],[-0.15,15.04],[-7.11,9.77]],"i":[[0.0,0.0],[4.63,0.0],[0.0,2.93]],"o":[[0.0,2.94],[-4.63,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.06,9.77],[6.69,9.82]],"i":[[0.0,0.0],[-6.7,2.47]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.0,-0.14],[8.13,-1.06],[4.95,-0.29]],"i":[[0.0,0.0],[1.02,0.05],[0.99,-0.49]],"o":[[-0.86,-0.55],[-1.1,0.02],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.92,-3.69],[-4.92,-0.69],[-7.92,2.31],[-10.92,-0.69]],"i":[[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,1.66]],"o":[[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60D":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-9.5,-8.56],[-15.62,-7.24],[-14.98,-5.43],[-9.66,0.99],[-9.66,0.99],[-4.44,-5.27],[-3.53,-7.76],[-9.66,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.08,-3.23]],"o":[[-1.27,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.58,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[9.8,-8.56],[3.74,-7.24],[4.37,-5.43],[9.65,0.99],[9.65,0.99],[14.82,-5.27],[15.72,-7.76],[9.64,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.07,-3.23]],"o":[[-1.25,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.57,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":false,"f":[0.8235,0.1843,0.1529]},{"v":[[12.59,6.67],[0.03,16.78],[-12.58,6.67]],"i":[[-12.14,3.03],[8.38,0.0],[0.0,5.62]],"o":[[0.0,5.63],[-8.37,0.0],[-0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[12.59,6.67],[0.03,16.78],[-12.58,6.67]],"i":[[-12.14,3.03],[8.38,0.0],[0.0,5.62]],"o":[[0.0,5.63],[-8.37,0.0],[-0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-9.5,-8.56],[-15.62,-7.24],[-14.98,-5.43],[-9.66,0.99],[-9.66,0.99],[-4.44,-5.27],[-3.53,-7.76],[-9.66,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.08,-3.23]],"o":[[-1.27,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.58,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.8,-8.56],[3.74,-7.24],[4.37,-5.43],[9.65,0.99],[9.65,0.99],[14.82,-5.27],[15.72,-7.76],[9.64,-8.56]],"i":[[0.0,0.0],[-0.32,-4.89],[-0.36,-0.54],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.02,0.91],[1.07,-3.23]],"o":[[-1.25,-3.35],[0.04,0.65],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.57,-0.7],[-0.09,-4.35],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60E":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[9.33,2.56],[16.51,-3.83],[15.66,-8.51],[9.33,-10.21],[2.88,-8.51],[2.15,-3.83]],"i":[[-3.97,0.0],[0.0,3.53],[1.3,1.16],[1.98,0.0],[1.31,-1.56],[0.0,-1.43]],"o":[[3.96,0.0],[0.0,-1.76],[-1.3,-1.16],[-2.36,0.0],[-0.89,1.07],[0.0,3.53]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[-10.26,2.56],[-3.08,-3.83],[-3.94,-8.51],[-10.26,-10.21],[-16.71,-8.51],[-17.44,-3.83]],"i":[[-3.97,0.0],[0.0,3.53],[1.3,1.16],[1.98,0.0],[1.31,-1.56],[0.0,-1.43]],"o":[[3.96,0.0],[0.0,-1.76],[-1.3,-1.16],[-2.36,0.0],[-0.89,1.07],[0.0,3.53]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[-0.11,-22.94],[22.89,0.06],[-0.11,23.06],[-23.11,0.06]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[9.7,8.86],[-9.93,8.86]],"i":[[0.0,0.0],[5.58,3.66]],"o":[[-6.57,3.52],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-17.12,-5.54],[-10.26,2.38],[-2.39,-5.96],[-3.2,-8.59],[-13.15,-10.01]],"i":[[0.53,-4.57],[-7.81,0.63],[-0.05,7.69],[0.8,1.03],[6.37,-0.55]],"o":[[0.0,0.0],[2.62,-0.21],[0.0,-0.7],[-1.06,-1.37],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-17.05,-6.07],[-17.48,-9.44],[-13.65,-9.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.74,-5.54],[9.88,2.38],[2.01,-5.96],[2.82,-8.59],[12.77,-10.01]],"i":[[-0.53,-4.57],[7.81,0.63],[0.05,7.69],[-0.8,1.03],[-6.37,-0.55]],"o":[[0.0,0.0],[-2.62,-0.21],[-0.0,-0.7],[1.06,-1.37],[-0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.5,-9.58],[4.16,-9.58]],"i":[[0.0,0.0],[-4.53,2.53]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.46,-4.68],[2.07,-4.68]],"i":[[0.0,0.0],[-2.33,-3.75]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.66,-6.07],[17.1,-9.44],[13.26,-9.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.05,-5.97],[1.65,-5.97]],"i":[[0.0,0.0],[-1.9,-3.75]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F60F":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.06,10.66],[10.92,6.53]],"i":[[0.0,0.0],[-0.31,4.55]],"o":[[8.5,0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.93,-9.23],[10.97,-9.8],[14.7,-8.08]],"i":[[0.0,0.0],[-2.52,-0.53],[-1.31,-0.9]],"o":[[0.47,-0.25],[2.12,0.39],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.71,-7.3],[-9.29,-9.98],[-4.93,-9.3]],"i":[[0.0,0.0],[-2.63,0.44],[-0.56,-0.29]],"o":[[0.33,-0.43],[2.13,-0.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.0,-3.0],[-7.0,0.0],[-10.0,-3.0],[-7.0,-6.0],[-4.0,-3.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.0,-3.0],[11.0,0.0],[8.0,-3.0],[11.0,-6.0],[14.0,-3.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F610":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-9.0,7.0],[9.0,7.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F612":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-5.91,7.09],[2.42,5.99],[10.0,8.93]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[3.13,-0.79],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.71,-9.3],[-8.29,-11.98],[-3.93,-11.3]],"i":[[0.0,0.0],[-2.63,0.44],[-0.56,-0.29]],"o":[[0.33,-0.43],[2.13,-0.36],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.93,-11.0],[11.97,-11.57],[15.7,-9.85]],"i":[[0.0,0.0],[-2.52,-0.53],[-1.31,-0.9]],"o":[[0.47,-0.25],[2.12,0.39],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.0,-5.0],[-7.0,-2.0],[-10.0,-5.0],[-7.0,-8.0],[-4.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[14.0,-5.0],[11.0,-2.0],[8.0,-5.0],[11.0,-8.0],[14.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F615":[{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,-0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[8.7,7.92],[-8.7,9.82]],"i":[[0.0,0.0],[5.99,-2.81]],"o":[[-6.33,-1.74],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F618":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[17.01,8.47],[12.52,10.9],[12.48,12.85],[12.59,13.2],[16.39,22.92],[24.95,16.84],[26.22,14.99],[23.79,10.49],[20.09,11.53],[19.77,11.61],[19.55,11.36]],"i":[[1.34,0.4],[0.57,-1.91],[-0.17,-0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.22,0.74],[1.91,0.57],[0.95,-1.04],[0.12,0.03],[0.02,0.12]],"o":[[-1.91,-0.57],[-0.19,0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.61,-0.46],[0.57,-1.91],[-1.34,-0.4],[-0.08,0.09],[-0.12,-0.03],[-0.22,-1.38]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-15.41,-5.99],[-12.74,-9.65],[-8.4,-11.03]],"i":[[0.0,0.0],[-1.31,0.85],[-1.57,-0.09]],"o":[[0.41,-1.51],[1.22,-0.98],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.06,-4.93],[6.52,-6.11]],"i":[[0.0,0.0],[2.79,-1.55]],"o":[[-2.27,-2.24],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.04,-0.14],[8.16,-1.07],[4.97,-0.29]],"i":[[0.0,0.0],[1.11,0.02],[1.07,-0.47]],"o":[[-0.81,-0.47],[-1.12,-0.02],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[22.37,5.36],[23.0,0.0],[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[10.09,20.67]],"i":[[0.0,0.0],[0.0,1.85],[12.7,0.0],[0.0,-12.7],[-12.7,0.0],[-3.05,1.49]],"o":[[0.41,-1.72],[0.0,-12.7],[-12.7,0.0],[0.0,12.7],[3.62,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-7.96,-3.69],[-4.96,-0.69],[-7.96,2.31],[-10.96,-0.69]],"i":[[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,1.66]],"o":[[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.41,5.09],[0.41,10.65],[0.41,15.57]],"i":[[0.0,0.0],[10.52,-2.37],[10.46,-1.92]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[17.01,8.47],[12.52,10.9],[12.48,12.85],[12.59,13.2],[16.39,22.92],[24.95,16.84],[26.22,14.99],[23.79,10.49],[20.09,11.53],[19.77,11.61],[19.55,11.36]],"i":[[1.34,0.4],[0.57,-1.91],[-0.17,-0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.22,0.74],[1.91,0.57],[0.95,-1.04],[0.12,0.03],[0.02,0.12]],"o":[[-1.91,-0.57],[-0.19,0.64],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.61,-0.46],[0.57,-1.91],[-1.34,-0.4],[-0.08,0.09],[-0.12,-0.03],[-0.22,-1.38]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F61B":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[5.67,10.59],[10.17,5.82],[-0.41,7.36],[-9.93,5.82],[-10.16,5.82],[-5.25,10.79]],"i":[[0.0,0.0],[-0.87,2.02],[4.42,0.05],[1.81,0.9],[0.0,0.0],[-2.2,-1.07]],"o":[[2.02,-1.09],[-1.98,0.99],[-4.05,-0.05],[0.0,0.0],[0.94,2.16],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[5.58,6.82],[-0.08,17.82],[-5.74,6.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"p":[{"v":[[-5.25,10.79],[-10.17,5.82]],"i":[[0.0,0.0],[0.94,2.16]],"o":[[-2.2,-1.07],[0.0,0.0]],"c":false},{"v":[[10.16,5.82],[5.67,10.59]],"i":[[0.0,0.0],[2.02,-1.09]],"o":[[-0.87,2.02],[0.0,0.0]],"c":false},{"v":[[-9.93,5.82],[-0.41,7.36],[10.16,5.82]],"i":[[0.0,0.0],[-4.05,-0.05],[-1.98,0.99]],"o":[[1.81,0.9],[4.42,0.05],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.66,6.82],[0.0,17.82],[-5.65,6.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F61C":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[5.67,9.59],[10.17,4.82],[-0.41,6.36],[-9.93,4.82],[-10.16,4.82],[-5.25,9.79]],"i":[[0.0,0.0],[-0.87,2.02],[4.42,0.05],[1.81,0.9],[0.0,0.0],[-2.2,-1.07]],"o":[[2.02,-1.09],[-1.98,0.99],[-4.05,-0.05],[0.0,0.0],[0.94,2.16],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[5.58,5.82],[-0.08,16.82],[-5.74,5.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"f":[0.9176,0.3529,0.2784]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[4.0,-4.27],[8.91,-5.91],[13.0,-4.27]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"p":[{"v":[[-5.25,9.79],[-10.17,4.82]],"i":[[0.0,0.0],[0.94,2.16]],"o":[[-2.2,-1.07],[0.0,0.0]],"c":false},{"v":[[10.16,4.82],[5.67,9.59]],"i":[[0.0,0.0],[2.02,-1.09]],"o":[[-0.87,2.02],[0.0,0.0]],"c":false},{"v":[[-9.93,4.82],[-0.41,6.36],[10.16,4.82]],"i":[[0.0,0.0],[-4.05,-0.05],[-1.98,0.99]],"o":[[1.81,0.9],[4.42,0.05],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.66,5.82],[0.0,16.82],[-5.65,5.82]],"i":[[0.0,0.0],[3.12,0.0],[0.0,6.08]],"o":[[0.0,6.08],[-3.12,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F620":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-12.0],[-6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-12.0],[6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.5,7.0],[0.34,6.0],[6.5,7.0]],"i":[[0.0,0.0],[-2.86,-0.03],[-1.17,-0.58]],"o":[[1.28,-0.64],[2.62,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F621":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.8863,0.4392,0.1333]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-8.0,10.0],[0.42,6.0],[8.0,10.0]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[1.58,-2.56],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-3.07],[-9.0,-0.07],[-12.0,-3.07],[-9.0,-6.07],[-6.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-3.07],[9.0,-0.07],[6.0,-3.07],[9.0,-6.07],[12.0,-3.07]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-13.0,-12.0],[-6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.0,-12.0],[6.0,-8.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F622":[{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,-0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-13.23,-2.18],[-16.52,3.74],[-13.88,6.79],[-10.83,4.16],[-10.83,4.16]],"i":[[0.91,1.25],[0.18,-2.43],[-1.52,-0.11],[-0.12,1.57],[0.0,0.0]],"o":[[-1.08,1.1],[-0.11,1.52],[1.57,0.11],[0.0,0.0],[0.18,-2.43]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-9.5,12.0],[0.5,6.0],[9.5,12.0]],"i":[[0.0,0.0],[-4.18,-0.2],[-1.71,-3.51]],"o":[[1.88,-3.83],[3.83,0.18],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.61,5.63],[-16.44,3.64],[-14.0,-1.31],[-13.25,-1.31],[-10.8,3.64],[-10.8,3.64],[-13.62,6.45]],"i":[[0.53,0.53],[-0.0,0.75],[-0.1,0.1],[-0.21,-0.21],[-0.0,-2.48],[0.0,0.0],[1.55,0.0]],"o":[[-0.53,-0.53],[0.0,-2.48],[0.21,-0.21],[0.1,0.1],[0.0,0.0],[-0.0,1.55],[-0.75,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F62D":[{"v":[[16.0,16.38],[17.0,9.0],[13.0,-2.0]],"i":[[0.0,0.0],[0.0,2.0],[0.0,0.0]],"o":[[0.88,-1.63],[0.0,-4.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[8.0,0.0],[11.0,10.0],[10.0,20.0]],"i":[[0.0,0.0],[0.0,-3.27],[0.0,-2.0]],"o":[[0.0,0.0],[0.0,3.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,16.4],[-17.0,9.0],[-13.0,-2.0]],"i":[[0.0,0.0],[0.0,2.0],[0.0,0.0]],"o":[[-0.88,-1.63],[0.0,-4.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-8.0,0.0],[-11.0,10.0],[-10.0,20.0]],"i":[[0.0,0.0],[0.0,-3.27],[0.0,-2.0]],"o":[[0.0,0.0],[0.0,3.06],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[0.2,-22.68],[-22.6,0.12],[0.2,22.92],[23.0,0.12]],"i":[[12.57,0.0],[0.0,-12.57],[-12.57,0.0],[0.0,12.57]],"o":[[-12.57,0.0],[0.0,12.57],[12.57,0.0],[0.0,-12.57]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.07,15.58],[-4.81,10.59],[0.09,5.93],[4.79,10.76],[-0.07,15.58]],"i":[[0.0,0.0],[0.0,2.62],[-2.46,0.0],[0.0,-2.62],[2.46,0.0]],"o":[[-2.46,0.0],[0.0,-2.62],[2.46,0.0],[0.0,2.62],[0.0,0.0]],"c":true,"f":[0.0,0.0,0.0]},{"v":[[-4.63,9.29],[4.63,9.29],[0.0,5.28]],"i":[[0.0,0.0],[-1.94,1.29],[0.0,0.0]],"o":[[2.03,1.29],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-6.3,-3.98],[-10.0,20.0],[-16.0,16.0],[-13.5,-3.18],[-6.3,-3.98]],"i":[[0.0,0.0],[-0.16,-9.71],[0.85,1.59],[-2.9,5.37],[-0.2,-1.28]],"o":[[-5.76,9.54],[0.0,1.8],[-2.17,-5.92],[2.89,-1.62],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[6.3,-3.6],[10.0,19.38],[16.25,15.38],[13.5,-2.8],[6.3,-3.6]],"i":[[0.0,0.0],[0.16,-9.71],[-0.85,1.59],[2.9,5.37],[0.2,-1.28]],"o":[[5.76,9.54],[0.0,1.8],[2.17,-5.92],[-2.89,-1.62],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"v":[[4.5,-3.18],[9.41,-4.82],[13.5,-3.18]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.5,-3.18],[-8.59,-4.82],[-4.5,-3.18]],"i":[[0.0,0.0],[-2.66,-0.16],[-0.48,-0.4]],"o":[[0.41,-0.34],[2.16,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[0.0,5.84],[4.76,10.6],[0.0,15.36],[-4.76,10.6]],"i":[[-2.63,0.0],[0.0,-2.63],[2.63,0.0],[0.0,2.63]],"o":[[2.63,0.0],[0.0,2.63],[-2.63,0.0],[0.0,-2.63]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F62E":[{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,5.6],[5.75,11.34],[0.0,17.09],[-5.75,11.34]],"i":[[-3.17,0.0],[0.0,-3.17],[3.17,0.0],[0.0,3.17]],"o":[[3.17,0.0],[0.0,3.17],[-3.17,0.0],[0.0,-3.17]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,5.6],[5.75,11.34],[0.0,17.09],[-5.75,11.34]],"i":[[-3.17,0.0],[0.0,-3.17],[3.17,0.0],[0.0,3.17]],"o":[[3.17,0.0],[0.0,3.17],[-3.17,0.0],[0.0,-3.17]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"1F633":[{"v":[[-18.0,3.88],[-16.0,1.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,7.88],[-12.0,3.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[18.0,3.88],[16.0,1.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[16.0,7.88],[12.0,3.88]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2},{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-2.5,-3.69],[-9.0,2.81],[-15.5,-3.69],[-9.0,-10.19],[-2.5,-3.69]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[15.5,-3.69],[9.0,2.81],[2.5,-3.69],[9.0,-10.19],[15.5,-3.69]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"f":[1.0,1.0,1.0]},{"v":[[-18.0,6.55],[-16.0,4.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[-16.0,10.55],[-12.0,6.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[18.0,6.55],[16.0,4.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[16.0,10.55],[12.0,6.55]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.9176,0.3529,0.2784],"sw":2.0,"lc":2,"lj":2},{"v":[[-6.44,-3.57],[-9.0,-1.01],[-11.55,-3.57],[-9.0,-6.13],[-6.44,-3.57]],"i":[[0.0,0.0],[1.41,0.0],[0.0,1.41],[-1.41,0.0],[0.0,-1.41]],"o":[[0.0,1.41],[-1.41,0.0],[0.0,-1.41],[1.41,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[11.56,-3.57],[9.0,-1.01],[6.45,-3.57],[9.0,-6.13],[11.56,-3.57]],"i":[[0.0,0.0],[1.41,0.0],[0.0,1.41],[-1.41,0.0],[0.0,-1.41]],"o":[[0.0,1.41],[-1.41,0.0],[0.0,-1.41],[1.41,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-2.5,-3.57],[-9.0,2.93],[-15.5,-3.57],[-9.0,-10.07],[-2.5,-3.57]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[15.5,-3.57],[9.0,2.93],[2.5,-3.57],[9.0,-10.07],[15.5,-3.57]],"i":[[0.0,0.0],[3.59,0.0],[0.0,3.59],[-3.59,0.0],[0.0,-3.59]],"o":[[0.0,3.59],[-3.59,0.0],[0.0,-3.59],[3.59,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-14.31,-13.56],[-9.73,-15.96],[-5.43,-15.01]],"i":[[0.0,0.0],[-2.65,0.28],[-0.54,-0.32]],"o":[[0.35,-0.41],[2.15,-0.22],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.43,-15.03],[10.54,-15.84],[14.31,-13.56]],"i":[[0.0,0.0],[-2.6,-0.59],[-0.41,-0.48]],"o":[[0.46,-0.27],[2.11,0.48],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,10.5],[-6.5,10.5]],"i":[[0.0,0.0],[1.17,0.58]],"o":[[-1.28,0.64],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F634":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,8.74],[3.4,12.14],[0.0,15.55],[-3.4,12.14]],"i":[[-1.88,0.0],[0.0,-1.88],[1.88,0.0],[0.0,1.88]],"o":[[1.88,0.0],[0.0,1.88],[-1.88,0.0],[0.0,-1.88]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[8.77,-21.27],[7.65,-21.7],[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0],[21.56,-8.03]],"i":[[0.0,0.0],[0.38,0.13],[2.68,0.0],[0.0,-12.7],[-12.7,0.0],[0.0,12.7],[0.93,2.5]],"o":[[-0.37,-0.15],[-2.39,-0.84],[-12.7,0.0],[0.0,12.7],[12.7,0.0],[0.0,-2.82],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,8.74],[3.4,12.14],[0.0,15.55],[-3.4,12.14]],"i":[[-1.88,0.0],[0.0,-1.88],[1.88,0.0],[0.0,1.88]],"o":[[1.88,0.0],[0.0,1.88],[-1.88,0.0],[0.0,-1.88]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.17,-3.14],[4.17,-3.14]],"i":[[0.0,0.0],[2.54,2.06]],"o":[[-3.18,2.34],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.17,-3.14],[-14.17,-3.14]],"i":[[0.0,0.0],[2.54,2.06]],"o":[[-3.18,2.34],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[8.87,-11.97],[6.26,-11.97],[5.39,-12.47],[5.39,-13.47],[7.15,-16.55],[6.26,-16.55],[5.26,-17.55],[6.26,-18.55],[8.87,-18.55],[9.74,-18.05],[9.74,-17.06],[7.98,-13.97],[8.87,-13.97],[9.87,-12.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[15.02,-15.97],[11.26,-15.97],[10.39,-16.47],[10.39,-17.47],[13.29,-22.55],[11.26,-22.55],[10.26,-23.55],[11.26,-24.55],[15.02,-24.55],[15.88,-24.05],[15.89,-23.06],[12.98,-17.97],[15.02,-17.97],[16.02,-16.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[23.16,-10.97],[18.26,-10.97],[17.39,-11.47],[17.39,-12.47],[21.44,-19.55],[18.26,-19.55],[17.26,-20.55],[18.26,-21.55],[23.16,-21.55],[24.03,-21.05],[24.03,-20.06],[19.98,-12.97],[23.16,-12.97],[24.16,-11.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[8.87,-11.97],[6.26,-11.97],[5.39,-12.47],[5.39,-13.47],[7.15,-16.55],[6.26,-16.55],[5.26,-17.55],[6.26,-18.55],[8.87,-18.55],[9.74,-18.05],[9.74,-17.06],[7.98,-13.97],[8.87,-13.97],[9.87,-12.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1},{"v":[[15.02,-15.97],[11.26,-15.97],[10.39,-16.47],[10.39,-17.47],[13.29,-22.55],[11.26,-22.55],[10.26,-23.55],[11.26,-24.55],[15.02,-24.55],[15.88,-24.05],[15.89,-23.06],[12.98,-17.97],[15.02,-17.97],[16.02,-16.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1},{"v":[[23.16,-10.97],[18.26,-10.97],[17.39,-11.47],[17.39,-12.47],[21.44,-19.55],[18.26,-19.55],[17.26,-20.55],[18.26,-21.55],[23.16,-21.55],[24.03,-21.05],[24.03,-20.06],[19.98,-12.97],[23.16,-12.97],[24.16,-11.97]],"i":[[0.55,0.0],[0.0,0.0],[0.18,0.31],[-0.18,0.31],[0.0,0.0],[0.0,0.0],[0.0,0.55],[-0.55,0.0],[0.0,0.0],[-0.18,-0.31],[0.18,-0.31],[0.0,0.0],[0.0,0.0],[0.0,-0.55]],"o":[[0.0,0.0],[-0.36,0.0],[-0.18,-0.31],[0.0,0.0],[0.0,0.0],[-0.55,0.0],[0.0,-0.55],[0.0,0.0],[0.36,0.0],[0.18,0.31],[0.0,0.0],[0.0,0.0],[0.55,0.0],[0.0,0.55]],"c":true,"f":[0.3804,0.698,0.8941],"s":[0.3804,0.698,0.8941],"sw":0.1}],"1F635":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.5,7.0],[0.34,6.0],[6.5,7.0]],"i":[[0.0,0.0],[-2.86,-0.03],[-1.17,-0.58]],"o":[[1.28,-0.64],[2.62,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[11.5,-7.0],[6.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.5,-7.0],[11.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-6.5,-7.0],[-11.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-11.5,-7.0],[-6.5,-3.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F641":[{"v":[[0.0,-23.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0]],"i":[[12.68,0.0],[0.0,-12.68],[-12.68,0.0],[0.0,12.68]],"o":[[-12.68,0.0],[0.0,12.68],[12.68,0.0],[0.0,-12.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[0.0,-23.0],[23.0,0.0],[0.0,23.0],[-23.0,0.0]],"i":[[-12.7,0.0],[0.0,-12.7],[12.7,0.0],[0.0,12.7]],"o":[[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,-12.7]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-6.0,-5.0],[-9.0,-2.0],[-12.0,-5.0],[-9.0,-8.0],[-6.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-5.0],[9.0,-2.0],[6.0,-5.0],[9.0,-8.0],[12.0,-5.0]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,-1.66]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[1.66,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-8.0,10.0],[0.42,6.0],[8.0,10.0]],"i":[[0.0,0.0],[-3.52,-0.13],[-1.44,-2.34]],"o":[[1.58,-2.56],[3.23,0.12],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F63A":[{"v":[[22.67,12.83],[-0.54,27.99],[-23.4,13.02],[-23.52,12.71],[-25.48,3.08],[-21.81,-30.29],[-10.58,-19.21],[-1.07,-21.15],[-0.01,-21.15],[9.5,-19.21],[20.73,-30.29],[24.45,3.58],[22.68,12.84]],"i":[[0.0,0.0],[10.58,0.0],[3.6,9.12],[0.0,0.0],[0.0,3.27],[0.0,0.0],[0.0,0.0],[-3.37,0.0],[0.0,0.0],[-2.92,-1.25],[0.0,0.0],[0.0,0.0],[1.14,-2.86]],"o":[[-3.6,9.12],[-9.12,0.0],[0.0,0.0],[-1.14,-2.86],[0.0,0.0],[0.0,0.0],[2.92,-1.25],[0.0,0.0],[3.37,0.0],[0.0,0.0],[0.0,0.0],[0.0,3.27],[0.0,0.0]],"c":false,"f":[0.9569,0.6667,0.2549]},{"v":[[-0.54,27.99],[23.41,12.87],[23.52,12.63],[25.48,2.47],[20.73,-30.29]],"i":[[0.0,0.0],[-3.6,9.12],[0.0,0.0],[0.0,3.27],[0.0,0.0]],"o":[[10.61,0.34],[0.0,0.0],[1.14,-2.86],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.8863,0.4392,0.1333]},{"v":[[19.11,-2.37],[5.85,4.25]],"i":[[0.0,0.0],[3.98,-15.9]],"o":[[0.0,0.0],[10.6,7.95]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-19.11,-2.37],[-5.85,4.25]],"i":[[0.0,0.0],[-3.98,-15.9]],"o":[[0.0,0.0],[-10.6,7.95]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-10.4,12.52],[0.0,9.4],[10.8,12.47],[7.32,17.71],[-6.35,17.82]],"i":[[0.0,0.0],[-2.6,7.28],[0.0,0.0],[0.79,-0.85],[4.27,3.94]],"o":[[0.0,0.0],[2.6,7.28],[0.0,0.0],[-4.02,4.31],[-0.94,-0.86]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[19.11,-2.31],[5.85,4.31]],"i":[[0.0,0.0],[3.98,-15.9]],"o":[[0.0,0.0],[10.6,7.95]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[26.0,18.13],[16.64,12.93]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[21.84,23.33],[12.48,18.13]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.71,12.0],[-24.44,3.05],[-20.8,-29.71],[-9.82,-19.0],[-0.52,-20.87],[0.52,-20.87],[9.82,-19.0],[20.8,-29.71],[24.44,3.05],[22.71,12.0]],"i":[[0.0,0.0],[0.0,3.16],[0.0,0.0],[0.0,0.0],[-3.3,0.0],[0.0,0.0],[-2.86,-1.21],[0.0,0.0],[0.0,0.0],[1.12,-2.77]],"o":[[-1.12,-2.77],[0.0,0.0],[0.0,0.0],[2.86,-1.21],[0.0,0.0],[3.3,0.0],[0.0,0.0],[0.0,0.0],[0.0,3.16],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-19.11,-2.31],[-5.85,4.31]],"i":[[0.0,0.0],[-3.98,-15.9]],"o":[[0.0,0.0],[-10.6,7.95]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-26.0,18.13],[-16.64,12.93]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-21.84,23.33],[-12.48,18.13]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-12.48,-1.63],[-10.4,0.45],[-12.48,2.53],[-14.56,0.45]],"i":[[-1.15,0.0],[0.0,-1.15],[1.15,0.0],[0.0,1.15]],"o":[[1.15,0.0],[0.0,1.15],[-1.15,0.0],[0.0,-1.15]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.48,-1.63],[14.56,0.45],[12.48,2.53],[10.4,0.45]],"i":[[-1.15,0.0],[0.0,-1.15],[1.15,0.0],[0.0,1.15]],"o":[[1.15,0.0],[0.0,1.15],[-1.15,0.0],[0.0,-1.15]],"c":true,"f":[0.0,0.0,0.0],"l":1},{"v":[[-4.36,9.47],[3.96,9.47]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.6,12.59],[-0.2,9.47],[10.6,12.54],[7.12,17.77],[-6.56,17.89]],"i":[[0.0,0.0],[-2.6,7.28],[0.0,0.0],[0.79,-0.85],[4.27,3.94]],"o":[[0.0,0.0],[2.6,7.28],[0.0,0.0],[-4.02,4.31],[-0.94,-0.86]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.15,23.39],[-0.52,27.0],[0.52,27.0],[13.15,23.39]],"i":[[0.0,0.0],[-4.64,0.0],[0.0,0.0],[-3.66,2.29]],"o":[[3.66,2.29],[0.0,0.0],[4.64,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F929":[{"v":[[0.0,-24.0],[24.0,0.0],[0.0,24.0],[-24.0,0.0]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-10.96,-14.76],[-2.97,-15.96],[-6.88,-8.89],[-3.27,-1.67],[-11.2,-3.2],[-16.95,2.47],[-17.95,-5.55],[-25.11,-9.27],[-17.8,-12.69],[-16.47,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.88,-14.76],[2.9,-15.96],[6.8,-8.89],[3.19,-1.67],[11.12,-3.2],[16.88,2.47],[17.87,-5.55],[25.04,-9.27],[17.72,-12.69],[16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[13.74,10.36],[0.04,17.59],[-13.76,10.23]],"i":[[-12.52,3.04],[7.35,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.03,0.46]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[14.61,5.87],[13.74,10.36],[-13.76,10.23],[-14.59,5.87],[-14.48,5.87],[14.41,5.94]],"i":[[0.0,0.0],[0.58,-1.38],[2.03,0.46],[0.0,1.54],[0.0,0.0],[-14.08,3.52]],"o":[[0.0,1.6],[-12.52,3.04],[-0.55,-1.35],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[14.61,5.87],[13.74,10.36],[-13.76,10.23],[-14.59,5.87],[-14.48,5.87],[14.41,5.94]],"i":[[0.0,0.0],[0.58,-1.38],[2.03,0.46],[0.0,1.54],[0.0,0.0],[-14.08,3.52]],"o":[[0.0,1.6],[-12.52,3.04],[-0.55,-1.35],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[13.74,10.36],[0.04,17.59],[-13.76,10.23]],"i":[[-12.52,3.04],[7.35,0.0],[1.77,4.33]],"o":[[-1.79,4.27],[-7.41,0.0],[2.03,0.46]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[14.23,10.24],[13.74,10.36]],"i":[[0.0,0.0],[0.16,-0.04]],"o":[[-0.16,0.04],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-13.76,10.23],[-14.04,10.16]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[-0.19,-0.05],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[10.55,-20.44],[0.0,-23.0],[-10.93,-20.24],[-11.08,-20.16]],"i":[[0.0,0.0],[3.8,0.0],[3.25,-1.76],[0.05,-0.03]],"o":[[-3.16,-1.64],[-3.95,0.0],[-0.05,0.03],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.81,-3.0],[-23.0,0.0],[0.0,23.0],[23.0,0.0],[22.81,-2.97]],"i":[[0.0,0.0],[0.0,-1.02],[-12.7,0.0],[0.0,12.7],[0.13,0.97]],"o":[[-0.13,0.98],[0.0,12.7],[12.7,0.0],[0.0,-1.01],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.88,-14.76],[-2.9,-15.96],[-6.8,-8.89],[-3.19,-1.67],[-11.12,-3.2],[-16.88,2.47],[-17.87,-5.55],[-25.04,-9.27],[-17.72,-12.69],[-16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.88,-14.76],[2.9,-15.96],[6.8,-8.89],[3.19,-1.67],[11.12,-3.2],[16.88,2.47],[17.87,-5.55],[25.04,-9.27],[17.72,-12.69],[16.4,-20.66]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F914":[{"v":[[0.0,-23.8],[24.0,0.2],[0.0,24.2],[-24.0,0.2]],"i":[[-13.25,0.0],[0.0,-13.25],[13.25,0.0],[0.0,13.25]],"o":[[13.25,0.0],[0.0,13.25],[-13.25,0.0],[0.0,-13.25]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-16.9,26.3],[-17.2,22.7],[-14.5,15.4],[-12.1,10.6],[-11.0,11.3],[-11.6,19.0],[-2.2,16.2],[5.7,15.2],[-1.8,19.6],[-0.9,20.9],[-1.9,22.1],[-1.3,23.5],[-4.1,25.8],[-4.0,28.5],[-8.8,29.9],[-14.0,29.8]],"i":[[0.6,1.5],[-0.1,1.2],[-0.4,0.8],[-1.0,0.3],[0.1,-0.6],[0.0,0.0],[0.0,0.0],[-0.2,-0.9],[2.1,0.1],[0.2,-0.7],[0.2,0.0],[-0.1,-0.9],[0.0,0.0],[3.2,-0.6],[0.0,0.0],[1.9,1.3]],"o":[[-0.3,-1.2],[0.2,-1.1],[0.4,-0.8],[1.0,-0.3],[-0.1,0.6],[0.0,0.0],[0.0,0.0],[2.1,2.0],[0.0,0.0],[-0.2,0.7],[-0.2,0.0],[0.9,1.8],[1.3,-0.2],[-1.0,0.3],[0.0,0.0],[-1.2,-0.8]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-7.1,8.5],[7.0,10.6]],"i":[[0.0,0.0],[-2.2,-1.6]],"o":[[2.4,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.6,-13.5],[-9.2,-14.6],[-5.0,-12.9]],"i":[[0.0,0.0],[-1.6,-0.2],[-1.1,-1.1]],"o":[[1.3,-0.9],[1.6,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[15.1,-9.5],[6.9,-9.8]],"i":[[0.0,0.0],[2.7,-0.5]],"o":[[-2.7,-0.7],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.0,22.4],[22.2,-5.8],[-6.0,-22.0],[-23.0,0.2],[-19.0,13.2]],"i":[[0.0,0.0],[3.3,12.3],[12.3,-3.3],[0.0,-10.4],[-2.6,-3.8]],"o":[[12.3,-3.3],[-3.3,-12.3],[-10.0,2.7],[0.0,4.6],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.0,-5.3],[-8.0,-2.3],[-11.0,-5.3],[-8.0,-8.3],[-5.0,-5.3]],"i":[[0.0,0.0],[1.7,0.0],[0.0,1.7],[-1.7,0.0],[0.0,-1.7]],"o":[[0.0,1.7],[-1.7,0.0],[0.0,-1.7],[1.7,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[12.0,-2.3],[9.0,0.7],[6.0,-2.3],[9.0,-5.3],[12.0,-2.3]],"i":[[0.0,0.0],[1.7,0.0],[0.0,1.7],[-1.7,0.0],[0.0,-1.7]],"o":[[0.0,1.7],[-1.7,0.0],[0.0,-1.7],[1.7,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-16.3,20.7],[-16.8,26.2],[-9.6,30.4],[-4.7,29.0],[-3.7,28.7],[-2.6,26.9],[-2.6,26.9],[-3.8,25.9],[-2.6,25.6],[-1.5,23.8],[-2.7,22.7],[-1.5,22.3],[-0.4,20.5],[-1.4,19.5],[5.0,17.6],[6.1,15.8],[4.3,14.7],[4.3,14.7],[-5.9,17.7],[-11.0,19.2],[-10.4,11.4],[-12.5,11.6]],"i":[[0.0,0.0],[-0.7,-1.8],[-3.2,1.0],[0.0,0.0],[0.0,0.0],[0.2,0.7],[0.0,0.0],[0.6,0.1],[0.0,0.0],[0.2,0.7],[0.6,0.1],[0.0,0.0],[0.2,0.7],[0.5,0.1],[0.0,0.0],[0.2,0.7],[0.7,-0.2],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.6,-1.4]],"o":[[-1.0,1.6],[1.1,3.3],[0.0,0.0],[0.0,0.0],[0.8,-0.2],[0.0,0.0],[-0.2,-0.5],[0.0,0.0],[0.8,-0.2],[-0.2,-0.5],[0.0,0.0],[0.8,-0.2],[-0.1,-0.5],[0.0,0.0],[0.8,-0.2],[-0.2,-0.7],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.1,-0.9],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F937":[{"v":[[-13.0,2.97],[-17.0,5.97],[-15.0,7.97],[-14.0,13.97],[-15.0,24.97],[15.0,24.97],[14.0,8.97],[17.0,5.97],[13.0,2.97]],"i":[[0.0,0.0],[0.0,-2.0],[0.0,0.0],[-0.16,-2.03],[0.0,0.0],[0.0,0.0],[-1.0,1.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.51,1.97],[0.0,2.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-2.0],[0.0,0.0]],"c":false,"f":[0.5725,0.8275,0.9608]},{"v":[[-11.0,-5.03],[0.0,8.97],[11.06,-5.03],[10.06,-10.03],[3.06,-18.03],[-9.94,-11.03]],"i":[[0.0,-5.0],[-6.06,0.0],[0.0,9.0],[0.68,1.58],[0.0,0.0],[6.0,-1.0]],"o":[[0.0,9.0],[5.94,0.0],[0.02,-1.72],[-3.0,-3.0],[-4.0,3.0],[0.0,-0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-22.03,24.97],[-19.09,12.66],[-20.03,11.41],[-24.03,8.41],[-28.03,2.41],[-28.03,0.41],[-26.03,0.41],[-22.03,4.41],[-17.03,6.41],[-14.03,11.41],[-15.03,24.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,0.55],[-0.55,-0.55],[0.0,0.0],[-3.0,-1.0],[0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,-0.55],[0.55,-0.55],[0.0,0.0],[1.0,1.0],[3.0,1.0],[-0.67,8.97],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[-16.01,6.85],[-18.13,0.96],[-20.03,0.8],[-20.03,4.49]],"i":[[0.0,0.0],[1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[-0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[22.03,24.97],[19.09,12.66],[20.03,11.41],[24.03,8.41],[28.03,2.41],[28.03,0.41],[26.03,0.41],[22.03,4.41],[17.03,6.41],[14.03,11.41],[15.03,24.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,0.55],[0.55,-0.55],[0.0,0.0],[3.0,-1.0],[-0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,-0.55],[-0.55,-0.55],[0.0,0.0],[-1.0,1.0],[-3.0,1.0],[0.67,8.97],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[16.01,6.85],[18.13,0.96],[20.03,0.8],[20.03,4.49]],"i":[[0.0,0.0],[-1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[10.2,-9.95],[2.84,-17.88],[-9.9,-10.9],[-9.95,2.96],[-13.95,-10.04],[0.05,-24.04],[14.05,-10.04],[10.05,2.96]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,7.0],[-10.0,0.0],[0.0,-7.0],[4.0,0.0]],"o":[[-2.66,-0.86],[-2.66,3.23],[-2.99,2.99],[-4.0,0.0],[0.0,-7.0],[10.0,0.0],[0.0,7.0],[1.32,-2.25]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.0,2.97],[14.0,-10.03],[0.0,-24.03],[-14.0,-10.03],[-10.0,2.97]],"i":[[0.0,0.0],[0.0,7.0],[10.0,0.0],[0.0,-7.0],[-4.0,0.0]],"o":[[4.0,0.0],[0.0,-7.0],[-10.0,0.0],[0.0,7.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.87,-6.03],[3.87,-4.03],[1.87,-6.03],[3.87,-8.03],[5.87,-6.03]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-2.13,-6.03],[-4.13,-4.03],[-6.13,-6.03],[-4.13,-8.03],[-2.13,-6.03]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-11.06,-5.03],[-0.06,8.97],[11.0,-5.03],[10.0,-10.03],[3.0,-18.03],[-10.0,-11.03]],"i":[[0.0,-5.0],[-6.06,0.0],[0.0,9.0],[0.68,1.58],[0.0,0.0],[6.0,-1.0]],"o":[[0.0,9.0],[5.94,0.0],[0.02,-1.72],[-3.0,-3.0],[-4.0,3.0],[0.0,-0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1},{"v":[[-1.92,1.97],[2.02,1.97]],"i":[[0.0,0.0],[-1.3,0.23]],"o":[[1.3,0.23],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.03,23.97],[-19.09,12.66],[-20.03,11.41],[-24.03,8.41],[-28.03,2.41],[-28.03,0.41],[-26.03,0.41],[-22.03,4.41],[-17.03,6.41],[-14.03,11.41],[-15.03,23.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,0.55],[-0.55,-0.55],[0.0,0.0],[-3.0,-1.0],[0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.55,-0.55],[0.55,-0.55],[0.0,0.0],[1.0,1.0],[3.0,1.0],[-0.67,8.97],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-16.01,6.85],[-18.13,0.96],[-20.03,0.8],[-20.03,4.49]],"i":[[0.0,0.0],[1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[-0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[22.03,23.97],[19.09,12.66],[20.03,11.41],[24.03,8.41],[28.03,2.41],[28.03,0.41],[26.03,0.41],[22.03,4.41],[17.03,6.41],[14.03,11.41],[15.03,23.97]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,0.55],[0.55,-0.55],[0.0,0.0],[3.0,-1.0],[-0.13,-1.76],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.55,-0.55],[-0.55,-0.55],[0.0,0.0],[-1.0,1.0],[-3.0,1.0],[0.67,8.97],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[16.01,6.85],[18.13,0.96],[20.03,0.8],[20.03,4.49]],"i":[[0.0,0.0],[-1.09,3.0],[0.0,-0.87],[0.0,0.0]],"o":[[0.0,0.0],[0.43,-1.18],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.0,3.97],[-10.0,2.97]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.0,2.97],[13.44,3.97]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F64C":[{"v":[[-15.43,-0.76],[-15.43,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[21.57,-0.05],[21.4,-18.72],[21.4,-17.95],[27.9,-17.12],[27.96,-10.69],[28.07,1.55],[27.94,-12.52],[33.59,-11.71],[33.6,12.67],[17.73,28.5],[1.78,12.56],[1.5,-2.82],[8.35,0.82],[8.35,5.71],[8.35,-17.35],[14.98,-16.78],[14.98,-19.7],[21.4,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-4.09],[0.0,0.0],[8.81,-0.0],[0.0,8.81],[0.0,7.09],[-1.2,-2.84],[0.0,0.0],[0.0,0.0],[-0.0,-4.51],[0.0,0.0],[-0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[-0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-3.17],[0.0,0.0],[0.0,8.81],[-8.81,0.0],[0.05,-3.07],[2.17,-2.17],[0.0,0.0],[0.0,0.0],[-0.0,-3.66],[0.0,0.0],[-0.0,-3.95],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[-22.02,-0.05],[-21.85,-18.72],[-21.85,-17.95],[-28.35,-17.12],[-28.41,-10.69],[-28.52,1.55],[-28.39,-12.52],[-34.04,-11.71],[-34.05,12.67],[-18.18,28.5],[-2.23,12.56],[-1.95,-2.82],[-8.8,0.82],[-8.8,5.71],[-8.8,-17.35],[-15.43,-16.78],[-15.43,-19.7],[-21.85,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-4.09],[0.0,0.0],[-8.81,-0.0],[-0.0,8.81],[-0.0,7.09],[1.2,-2.84],[0.0,0.0],[0.0,0.0],[0.0,-4.51],[0.0,0.0],[0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-3.17],[0.0,0.0],[-0.0,8.81],[8.81,0.0],[-0.05,-3.07],[-2.17,-2.17],[0.0,0.0],[0.0,0.0],[0.0,-3.66],[0.0,0.0],[0.0,-3.95],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[21.57,-0.05],[21.4,-18.72],[21.4,-17.95],[27.9,-17.12],[27.96,-10.69],[28.07,1.55],[27.94,-12.52],[33.59,-11.71],[33.6,12.67],[17.73,28.5],[1.78,12.56],[1.5,-2.82],[8.35,0.82],[8.35,5.71],[8.35,-17.35],[14.98,-16.78],[14.98,-19.7],[21.4,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-4.09],[0.0,0.0],[8.81,-0.0],[0.0,8.81],[0.0,7.09],[-1.2,-2.84],[0.0,0.0],[0.0,0.0],[-0.0,-4.51],[0.0,0.0],[-0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[-0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-0.0,-3.17],[0.0,0.0],[0.0,8.81],[-8.81,0.0],[0.05,-3.07],[2.17,-2.17],[0.0,0.0],[0.0,0.0],[-0.0,-3.66],[0.0,0.0],[-0.0,-3.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[14.98,1.55],[14.98,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-15.43,1.55],[-15.43,-16.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-22.02,-0.05],[-21.85,-18.72],[-21.85,-17.95],[-28.35,-17.12],[-28.41,-10.69],[-28.52,1.55],[-28.39,-12.52],[-34.04,-11.71],[-34.05,12.67],[-18.18,28.5],[-2.23,12.56],[-1.95,-2.82],[-8.8,0.82],[-8.8,5.71],[-8.8,-17.35],[-15.43,-16.78],[-15.43,-19.7],[-21.85,-17.95]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-5.3],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-4.09],[0.0,0.0],[-8.81,-0.0],[-0.0,8.81],[-0.0,7.09],[1.2,-2.84],[0.0,0.0],[0.0,0.0],[0.0,-4.51],[0.0,0.0],[0.0,-7.07]],"o":[[0.0,0.0],[0.0,0.0],[0.0,-3.52],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-3.17],[0.0,0.0],[-0.0,8.81],[8.81,0.0],[-0.05,-3.07],[-2.17,-2.17],[0.0,0.0],[0.0,0.0],[0.0,-3.66],[0.0,0.0],[0.0,-3.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1FAE1":[{"v":[[2.0,-22.3],[-21.0,0.7],[2.0,23.7],[25.0,0.7]],"i":[[12.7,0.0],[0.0,-12.7],[-12.7,0.0],[0.0,12.7]],"o":[[-12.7,0.0],[0.0,12.7],[12.7,0.0],[-0.0,-12.7]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-26.0,-1.7],[-19.4,-8.0],[-14.7,-7.2],[-9.1,-9.9],[-6.5,-12.7],[-8.7,-13.5],[-15.2,-12.5],[-1.5,-21.97],[-1.34,-22.62],[-1.5,-22.77],[-7.6,-22.5],[-20.6,-15.7],[-28.75,-9.25],[-29.65,-8.51],[-26.67,-1.7]],"i":[[0.0,0.0],[0.0,0.0],[-2.1,0.1],[-2.3,0.4],[0.7,1.3],[0.83,-0.2],[1.8,0.4],[-5.8,4.3],[0.13,0.22],[0.06,0.04],[3.2,-1.4],[0.0,0.0],[2.9,-2.2],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[1.7,1.3],[2.0,-0.1],[2.1,-0.4],[-0.5,-0.69],[-2.1,0.5],[0.0,0.0],[0.22,-0.13],[-0.04,-0.06],[-0.8,-0.5],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.4,-22.1],[1.8,-22.2],[24.8,0.8],[1.8,23.8],[-21.2,0.8],[-21.2,0.8],[-20.1,-6.2]],"i":[[0.0,0.0],[-0.73,-0.02],[0.0,-12.7],[12.7,0.0],[0.0,12.7],[0.0,0.0],[-0.72,2.26]],"o":[[0.73,-0.08],[12.7,0.0],[0.0,12.7],[-12.7,0.0],[0.0,0.0],[0.01,-2.38],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[-7.1,7.8],[-1.2,8.3],[5.0,8.3],[11.0,7.8]],"i":[[0.0,0.0],[0.0,0.0],[-2.06,0.2],[0.0,0.0]],"o":[[0.0,0.0],[2.06,0.2],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-4.1,-4.2],[-7.1,-1.2],[-10.1,-4.2],[-7.1,-7.2],[-7.1,-7.2],[-4.1,-4.2]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,0.0],[-0.0,-1.65]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[0.0,0.0],[1.65,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[13.9,-4.2],[10.9,-1.2],[7.9,-4.2],[10.9,-7.2],[10.9,-7.2],[13.9,-4.31],[13.9,-4.2]],"i":[[0.0,0.0],[1.66,0.0],[0.0,1.66],[-1.66,0.0],[0.0,0.0],[-0.03,-1.63],[0.0,-0.04]],"o":[[0.0,1.66],[-1.66,0.0],[0.0,-1.66],[0.0,0.0],[1.63,-0.03],[0.0,0.04],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-25.7,-2.0],[-18.4,-7.9],[-14.5,-6.9],[-7.4,-9.9],[-7.0,-13.3],[-14.3,-12.4],[0.1,-22.3],[-2.8,-23.55],[-7.1,-22.9],[-17.4,-17.3],[-22.8,-13.7],[-28.8,-9.0]],"i":[[0.0,0.0],[0.0,0.0],[-2.1,0.1],[-2.9,0.3],[1.7,0.2],[0.0,0.0],[-5.8,4.4],[1.88,0.27],[1.72,-0.71],[0.0,0.0],[1.67,-1.38],[1.8,-1.4]],"o":[[0.0,0.0],[1.7,1.3],[2.5,0.0],[2.7,-0.5],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.13,-0.16],[0.0,0.0],[-1.92,1.01],[-2.3,1.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"2764":[{"v":[[23.5,-11.0],[11.0,-23.5],[0.0,-16.94],[-11.0,-23.5],[-23.5,-11.0],[-20.73,-3.16],[-20.73,-3.16],[-0.0,22.54],[20.73,-3.16],[20.72,-3.16],[23.49,-11.0]],"i":[[0.0,0.0],[6.9,0.0],[2.11,-3.91],[4.75,0.0],[0.0,-6.9],[-1.73,-2.14],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.97]],"o":[[0.0,-6.9],[-4.75,0.0],[-2.11,-3.91],[-6.9,0.0],[0.0,2.97],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.73,-2.14],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[23.5,-11.0],[11.0,-23.5],[0.0,-16.94],[-11.0,-23.5],[-23.5,-11.0],[-20.73,-3.16],[-20.73,-3.16],[-0.0,22.54],[20.73,-3.16],[20.72,-3.16],[23.49,-11.0]],"i":[[0.0,0.0],[6.9,0.0],[2.11,-3.91],[4.75,0.0],[0.0,-6.9],[-1.73,-2.14],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.97]],"o":[[0.0,-6.9],[-4.75,0.0],[-2.11,-3.91],[-6.9,0.0],[0.0,2.97],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.73,-2.14],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lj":2,"l":1}],"1F494":[{"v":[[13.57,-20.39],[3.38,-14.21],[0.0,-6.32],[7.0,-0.31],[1.0,8.12],[6.0,15.0],[2.41,24.16],[22.88,-2.07],[25.09,-8.87]],"i":[[6.35,0.0],[2.0,-3.82],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.47]],"o":[[-4.32,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.44,-1.97],[0.0,-6.35]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[1.1,14.98],[-3.95,8.02],[1.98,-0.02],[-5.06,-5.97],[-3.61,-13.86],[-13.98,-20.39],[-25.5,-8.87],[-23.83,-2.89],[-23.17,-1.91],[-2.71,24.32],[-2.36,23.87]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.17,0.35],[4.45,0.0],[0.0,-6.35],[-1.09,-1.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.94,-4.03],[-6.35,0.0],[0.0,2.12],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[13.57,-20.39],[3.38,-14.21],[0.0,-6.32],[7.0,-0.31],[1.0,8.12],[6.0,15.0],[2.41,24.16],[22.88,-2.07],[25.09,-8.87]],"i":[[6.35,0.0],[2.0,-3.82],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,2.47]],"o":[[-4.32,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[1.44,-1.97],[0.0,-6.35]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.1,14.98],[-3.95,8.02],[1.98,-0.02],[-5.06,-5.97],[-3.61,-13.86],[-13.98,-20.39],[-25.5,-8.87],[-23.83,-2.89],[-23.17,-1.91],[-2.71,24.32],[-2.36,23.87]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.17,0.35],[4.45,0.0],[0.0,-6.35],[-1.09,-1.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.94,-4.03],[-6.35,0.0],[0.0,2.12],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F44D":[{"v":[[1.09,-24.77],[-1.83,-24.12],[-17.0,-6.79],[-24.33,6.27],[-22.33,17.54],[-9.4,24.61],[0.23,24.57],[14.27,24.78],[16.67,23.21],[17.42,19.38],[16.67,17.79],[20.25,17.71],[21.58,16.04],[22.42,13.71],[20.83,10.71],[22.42,10.04],[24.33,7.38],[23.42,4.63],[20.92,3.46],[22.08,1.29],[22.25,-2.12],[19.67,-3.62],[6.5,-4.12],[5.67,-4.79],[4.81,-5.39],[-4.31,-5.39],[-4.25,-7.12],[-0.33,-16.71],[1.33,-21.29]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-0.76,23.6],[-9.76,23.6],[-23.76,8.6],[-18.76,-4.4]],"i":[[0.0,0.0],[0.0,0.0],[0.0,8.32],[-3.2,3.58]],"o":[[0.0,0.0],[-8.32,0.0],[0.02,-4.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-1.38,-4.4],[-5.76,-4.4],[1.24,-22.4],[-3.76,-23.4],[-18.76,-4.4]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[2.21,-2.8],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.81,-2.08],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.45,-0.9],[5.45,2.6],[18.45,2.6],[22.41,-0.43],[19.38,-4.4],[18.45,-4.4],[5.45,-4.4]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[2.3,20.44],[6.3,23.94],[13.3,23.94],[17.27,20.9],[14.24,16.94],[13.31,16.94],[6.31,16.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.76,6.44],[1.24,9.94],[20.24,9.94],[24.2,6.9],[21.17,2.94],[20.24,2.94],[1.24,2.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-0.76,13.44],[3.24,16.94],[18.24,16.94],[22.2,13.9],[19.17,9.94],[18.24,9.94],[3.24,9.94]],"i":[[0.15,-2.06],[-2.07,0.12],[0.0,0.0],[-0.26,1.93],[1.93,0.26],[0.31,-0.04],[0.0,0.0]],"o":[[0.15,2.06],[0.0,0.0],[1.93,0.26],[0.26,-1.93],[-0.31,-0.04],[0.0,0.0],[-2.07,-0.12]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-21.86,0.26],[-23.77,8.1],[-8.65,23.6]],"i":[[0.0,0.0],[0.08,-2.72],[-10.5,0.0]],"o":[[-1.18,2.45],[0.0,8.56],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F44E":[{"v":[[1.33,21.21],[-0.33,16.62],[-4.25,7.04],[-4.31,5.3],[4.81,5.3],[5.67,4.71],[6.5,4.04],[19.67,3.54],[22.25,2.04],[22.08,-1.38],[20.92,-3.54],[23.42,-4.71],[24.33,-7.46],[22.42,-10.13],[20.83,-10.79],[22.42,-13.79],[21.58,-16.13],[20.25,-17.79],[16.67,-17.88],[17.42,-19.46],[16.67,-23.29],[14.27,-24.86],[0.23,-24.65],[-9.4,-24.7],[-22.33,-17.63],[-24.33,-6.35],[-17.0,6.71],[-1.83,24.04],[1.09,24.69]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-18.76,4.32],[-23.76,-8.68],[-9.76,-23.68],[-0.76,-23.68]],"i":[[0.0,0.0],[0.02,4.8],[-8.32,0.0],[0.0,0.0]],"o":[[-3.2,-3.58],[0.0,-8.32],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-18.76,4.32],[-3.76,23.32],[1.24,22.32],[-5.76,4.32],[-1.37,4.32]],"i":[[0.0,0.0],[0.0,0.0],[0.81,2.08],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[2.21,2.8],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[5.45,4.32],[18.45,4.32],[19.38,4.32],[22.41,0.35],[18.45,-2.68],[5.45,-2.68],[1.45,0.82]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.3,-17.02],[13.3,-17.02],[14.24,-17.02],[17.27,-20.99],[13.3,-24.02],[6.3,-24.02],[2.3,-20.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.24,-3.02],[20.24,-3.02],[21.17,-3.02],[24.2,-6.99],[20.24,-10.02],[1.24,-10.02],[-2.76,-6.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[3.24,-10.02],[18.24,-10.02],[19.17,-10.02],[22.2,-13.99],[18.24,-17.02],[3.24,-17.02],[-0.76,-13.52]],"i":[[-2.07,0.12],[0.0,0.0],[-0.31,0.04],[0.26,1.93],[1.93,-0.26],[0.0,0.0],[0.15,-2.06]],"o":[[0.0,0.0],[0.31,0.04],[1.93,-0.26],[-0.26,-1.93],[0.0,0.0],[-2.07,-0.12],[0.15,2.06]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.64,-23.69],[-23.77,-8.19],[-21.86,-0.35]],"i":[[0.0,0.0],[0.0,-8.56],[-1.18,-2.45]],"o":[[-10.5,0.0],[0.08,2.72],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F480":[{"v":[[5.18,-21.78],[0.01,-22.55],[-0.03,-22.55],[-3.76,-22.17],[-14.61,-15.2],[-18.51,-6.14],[-13.71,11.08],[-13.58,11.22],[-11.08,15.78],[-11.1,20.77],[-12.1,21.77],[-12.1,21.77],[-5.09,24.3],[6.44,23.99]],"i":[[3.63,14.74],[1.75,0.0],[0.0,0.0],[1.23,-0.25],[2.66,-3.56],[0.54,-3.29],[-4.11,-4.72],[0.0,0.0],[0.0,-1.73],[0.0,0.0],[0.55,0.0],[0.0,0.0],[-2.43,-0.55],[-3.76,1.07]],"o":[[-1.68,-0.51],[0.0,0.0],[-1.25,0.0],[-4.34,0.93],[-2.02,2.65],[-1.08,6.17],[0.0,0.0],[1.05,1.19],[0.0,0.0],[0.0,0.55],[0.0,0.0],[2.22,1.13],[3.81,0.86],[3.21,-15.18]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[12.89,-17.14],[5.18,-21.79],[6.44,23.98],[12.04,21.71],[11.03,20.72],[10.96,15.78],[13.38,11.46],[13.79,11.01],[12.9,-17.14]],"i":[[0.0,0.0],[2.91,0.89],[3.22,-15.17],[-1.78,0.97],[0.01,0.55],[0.0,0.0],[-1.02,1.13],[-0.12,0.14],[7.56,7.73]],"o":[[-2.15,-2.16],[3.63,14.74],[1.95,-0.54],[-0.55,0.0],[0.0,0.0],[0.0,-1.65],[0.15,-0.16],[7.05,-8.19],[0.0,0.0]],"c":true,"f":[0.8157,0.8118,0.8078]},{"v":[[-8.14,0.36],[-12.64,4.86],[-8.14,9.36],[-3.64,4.86]],"i":[[2.49,0.0],[0.0,-2.49],[-2.49,0.0],[0.0,2.49]],"o":[[-2.49,0.0],[0.0,2.49],[2.49,0.0],[0.0,-2.49]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[8.21,0.36],[3.71,4.86],[8.21,9.36],[12.71,4.86]],"i":[[2.49,0.0],[0.0,-2.49],[-2.49,0.0],[0.0,2.49]],"o":[[-2.49,0.0],[0.0,2.49],[2.49,0.0],[0.0,-2.49]],"c":true,"f":[0.2471,0.2471,0.2471]},{"v":[[12.02,20.66],[11.95,15.72],[14.53,11.62],[19.83,-2.62],[-0.03,-23.61],[-3.95,-23.2],[-19.5,-6.36],[-14.46,11.69],[-12.08,15.73],[-12.1,20.71]],"i":[[0.0,0.0],[0.0,0.0],[-0.93,1.07],[0.02,5.23],[10.96,-0.02],[1.29,-0.27],[1.37,-8.38],[-4.32,-4.94],[0.0,-1.42],[0.0,0.0]],"o":[[0.0,0.0],[0.0,-1.45],[3.43,-3.95],[0.0,-11.6],[-1.32,0.0],[-7.89,1.62],[-1.13,6.47],[0.92,1.04],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.14,19.0],[-8.14,23.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.42,20.07],[-2.42,24.85]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[8.21,19.0],[8.21,23.78]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[3.03,20.07],[3.03,24.85]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-2.96,16.21],[-0.03,10.36],[3.47,16.21]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-8.14,-0.18],[-3.14,4.82],[-8.14,9.82],[-13.14,4.82]],"i":[[-2.76,0.0],[0.0,-2.76],[2.76,0.0],[0.0,2.76]],"o":[[2.76,0.0],[0.0,2.76],[-2.76,0.0],[0.0,-2.76]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1},{"v":[[8.21,-0.18],[13.21,4.82],[8.21,9.82],[3.21,4.82]],"i":[[-2.76,0.0],[0.0,-2.76],[2.76,0.0],[0.0,2.76]],"o":[[2.76,0.0],[0.0,2.76],[-2.76,0.0],[0.0,-2.76]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"l":1}],"1F525":[{"v":[[15.33,22.3],[17.78,-3.27],[16.8,-3.37],[14.79,-1.39],[13.45,-3.27],[-0.9,-31.81],[-2.06,-31.11],[-5.16,-17.29],[-5.82,-16.98],[-9.34,0.47],[-9.34,1.42],[-11.9,3.5],[-14.31,-4.33],[-15.51,-4.66],[-15.59,21.66],[-15.06,24.79],[-15.21,25.14],[-14.54,26.54],[-0.25,31.72],[13.58,26.99],[14.85,25.31],[15.33,22.3]],"i":[[0.0,0.0],[1.59,3.7],[0.05,-0.46],[1.6,0.39],[0.0,1.32],[3.84,3.24],[-0.11,-0.67],[1.49,0.47],[0.12,-0.25],[0.11,-3.18],[0.0,-0.27],[1.15,0.51],[0.01,1.45],[0.39,-0.55],[-2.24,-3.12],[0.37,-1.05],[0.06,-0.11],[0.0,0.0],[-8.82,0.0],[-1.88,1.67],[0.0,0.82],[-0.51,0.5]],"o":[[7.56,-9.79],[-0.18,-0.42],[-0.12,1.08],[-0.82,-0.2],[0.51,-15.05],[-0.51,-0.43],[2.46,15.33],[-0.26,-0.08],[-4.59,9.7],[0.0,0.26],[0.0,1.75],[-2.05,-0.92],[-0.0,-0.68],[-8.8,12.27],[0.65,0.9],[-0.04,0.12],[-0.4,0.8],[1.32,1.23],[7.13,-0.0],[0.88,-0.78],[-0.0,-0.98],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[0.29,-3.44],[-3.91,4.91],[-4.09,5.22],[-5.15,12.28],[-5.15,12.28],[-8.13,16.25],[-9.38,15.77],[-10.73,16.63],[-4.58,28.3],[-3.14,30.27],[-3.08,30.32],[2.2,30.32],[2.41,30.27],[5.61,26.49],[9.35,21.14],[8.72,19.94],[7.7,18.75],[7.7,18.75],[8.3,16.19],[8.66,13.83],[7.38,13.11],[4.78,12.04],[4.7,6.58],[1.87,-3.79]],"i":[[0.15,-0.75],[2.89,-4.35],[0.06,-0.11],[-0.29,-3.71],[0.0,-0.0],[2.4,0.36],[0.33,0.23],[-0.07,-0.74],[-4.55,-3.59],[-0.16,-0.92],[-0.03,0.0],[0.0,0.0],[-0.01,0.04],[-2.84,2.52],[-0.58,1.45],[0.54,0.09],[0.3,0.82],[0.0,0.0],[-0.82,1.72],[0.06,0.7],[0.56,-0.28],[0.73,1.61],[-0.57,3.89],[1.82,2.51]],"o":[[-0.29,1.46],[-0.06,0.11],[-0.31,0.69],[0.0,0.0],[-0.0,0.0],[-0.51,-0.08],[-0.61,-0.42],[0.32,3.19],[0.0,0.0],[0.01,0.03],[0.0,0.0],[0.18,0.0],[0.04,-0.24],[2.0,-1.77],[0.2,-0.51],[-0.34,-0.06],[-0.0,-0.0],[-0.01,-0.02],[0.38,-0.8],[-0.06,-0.63],[-0.78,0.4],[0.0,0.0],[0.44,-2.97],[-0.45,-0.62]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-14.37,25.56],[-0.38,31.03],[13.86,25.56]],"i":[[0.0,0.0],[-5.32,0.0],[-3.53,3.51]],"o":[[3.48,3.61],[5.05,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-14.49,21.46],[-14.94,-4.52],[-13.69,2.06],[-11.34,4.02],[-8.92,1.44],[-8.92,0.53],[-5.35,-16.66],[-1.36,-31.28],[12.92,-3.06],[15.08,-0.76],[17.24,-3.06],[14.73,21.46]],"i":[[0.0,0.0],[-10.08,14.78],[-1.06,-2.52],[-1.14,0.0],[0.0,1.67],[0.0,0.25],[-4.1,9.52],[3.05,18.4],[0.6,-17.77],[-1.19,0.0],[0.0,1.27],[8.84,-11.44]],"o":[[0.0,0.0],[0.0,0.0],[0.48,1.04],[1.34,0.0],[0.0,-0.26],[0.11,-3.1],[0.0,0.0],[0.0,0.0],[0.0,1.27],[1.19,0.0],[0.08,0.13],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-13.18,-13.03],[-11.26,-16.35],[-9.66,-20.18]],"i":[[0.0,0.0],[-1.21,1.04],[0.31,2.2]],"o":[[0.2,-1.04],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F4AF":[{"v":[[23.18,10.06],[-22.82,10.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[23.18,18.06],[-22.82,18.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[-3.02,1.0],[-3.02,1.0],[-9.3,-5.27],[-9.3,-15.66],[-3.02,-21.94],[-3.02,-21.94],[3.26,-15.66],[3.26,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[16.91,1.0],[16.91,1.0],[10.63,-5.27],[10.63,-15.66],[16.91,-21.94],[16.91,-21.94],[23.19,-15.66],[23.19,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[-23.02,-17.11],[-16.66,-21.87],[-16.66,1.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":4.0,"lc":2,"lj":2,"l":1},{"v":[[23.18,10.06],[-22.82,10.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[23.18,18.06],[-22.82,18.06]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[-3.02,1.0],[-3.02,1.0],[-9.3,-5.27],[-9.3,-15.66],[-3.02,-21.94],[-3.02,-21.94],[3.26,-15.66],[3.26,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[16.91,1.0],[16.91,1.0],[10.63,-5.27],[10.63,-15.66],[16.91,-21.94],[16.91,-21.94],[23.19,-15.66],[23.19,-5.27]],"i":[[3.47,0.0],[0.0,0.0],[0.0,3.47],[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0]],"o":[[0.0,0.0],[-3.47,0.0],[0.0,0.0],[0.0,-3.47],[0.0,0.0],[3.47,0.0],[0.0,0.0],[0.0,3.47]],"c":true,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2},{"v":[[-23.02,-17.11],[-16.66,-21.87],[-16.66,1.07]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.8235,0.1843,0.1529],"sw":4.1,"lc":2,"lj":2}],"1F4A9":[{"v":[[-13.0,-2.0],[-14.0,-7.0],[-11.0,-10.0],[-8.0,-12.0],[-6.0,-19.0],[-5.0,-23.0],[4.0,-18.0],[8.0,-14.0],[7.0,-9.0],[12.0,-8.0],[14.0,-5.0],[13.0,-1.0],[17.0,0.0],[20.0,3.0],[18.0,9.0],[22.0,10.0],[24.0,15.0],[19.0,20.0],[8.8,19.6],[-9.2,19.2],[-22.0,15.0],[-19.0,10.0],[-17.0,9.0],[-19.0,5.0],[-16.0,0.0]],"i":[[0.0,0.0],[-0.5,2.0],[-1.7,1.2],[-1.0,0.3],[-0.5,2.5],[-0.4,1.31],[-2.89,-1.85],[-0.5,-1.6],[0.5,-0.9],[-1.45,-1.03],[-0.23,-1.23],[0.86,-1.14],[-1.23,-0.67],[-0.61,-1.32],[1.8,-1.7],[-1.14,-0.87],[0.27,-1.9],[0.4,-0.1],[4.9,0.6],[6.0,0.0],[0.0,3.0],[-0.7,0.5],[-0.7,0.27],[0.0,1.0],[-1.9,1.8]],"o":[[0.0,0.0],[0.3,-1.2],[1.6,-1.1],[0.7,-2.5],[0.26,-1.35],[3.1,1.48],[2.3,1.5],[0.6,2.1],[1.73,-0.39],[1.05,0.68],[0.22,1.41],[1.4,-0.01],[1.32,0.61],[0.7,1.9],[1.41,-0.23],[1.51,1.19],[-0.5,3.5],[-2.2,0.7],[-4.4,-0.6],[-5.5,1.1],[0.0,-2.7],[0.63,-0.39],[-1.0,-2.0],[0.0,-1.2],[2.1,-2.1]],"c":true,"f":[0.6471,0.4745,0.2235]},{"v":[[-5.0,-23.0],[4.0,-18.0],[8.0,-14.0],[7.0,-9.0],[12.0,-8.0],[14.0,-5.0],[13.0,-1.0],[17.0,0.0],[20.0,3.0],[18.0,9.0],[22.0,10.0],[24.0,15.0],[19.0,20.0],[9.0,18.0],[17.0,15.0],[13.0,11.0],[7.0,4.0],[3.0,-5.0],[2.0,-15.0]],"i":[[4.0,2.0],[-2.89,-1.85],[-0.5,-1.6],[0.5,-0.9],[-1.45,-1.03],[-0.23,-1.23],[0.86,-1.14],[-1.23,-0.67],[-0.61,-1.32],[1.8,-1.7],[-1.14,-0.87],[0.27,-1.9],[0.4,-0.1],[-4.8,0.8],[-0.1,0.3],[2.0,0.0],[5.3,1.2],[3.8,0.9],[1.4,2.8]],"o":[[3.1,1.48],[2.3,1.5],[0.6,2.1],[1.73,-0.39],[1.05,0.68],[0.22,1.41],[1.4,-0.01],[1.32,0.61],[0.7,1.9],[1.41,-0.23],[1.51,1.19],[-0.5,3.5],[-2.2,0.7],[6.0,-1.0],[1.0,-2.0],[0.2,-3.3],[0.7,-3.2],[2.0,-4.0],[-2.0,-4.0]],"c":true,"f":[0.4157,0.2745,0.1843]},{"v":[[-8.8,-3.5],[-3.9,3.4],[-8.8,10.3],[-13.7,3.4]],"i":[[-2.71,0.0],[0.0,-3.81],[2.71,0.0],[0.0,3.81]],"o":[[2.71,0.0],[0.0,3.81],[-2.71,0.0],[0.0,-3.81]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[7.6,-4.0],[12.5,2.9],[7.6,9.8],[2.7,2.9]],"i":[[-2.71,0.0],[0.0,-3.81],[2.71,0.0],[0.0,3.81]],"o":[[2.71,0.0],[0.0,3.81],[-2.71,0.0],[0.0,-3.81]],"c":true,"f":[1.0,1.0,1.0]},{"p":[{"v":[[-17.0,9.0],[-18.0,2.0],[-13.0,-1.0]],"i":[[0.0,0.0],[-1.6,2.9],[-0.4,0.1]],"o":[[-0.1,-0.2],[1.3,-2.3],[0.0,0.0]],"c":false},{"v":[[7.0,-9.0],[8.0,-14.0],[3.0,-19.0],[-5.0,-23.0],[-5.0,-20.0],[-6.0,-15.0]],"i":[[0.0,0.0],[0.5,1.6],[4.1,2.0],[0.0,0.0],[0.19,-0.99],[0.3,-1.7]],"o":[[0.3,-0.9],[-0.4,-1.3],[0.0,0.0],[0.19,0.99],[-0.2,1.1],[0.0,0.0]],"c":false},{"v":[[18.0,9.0],[24.0,13.0],[18.0,20.0],[6.3,18.4]],"i":[[0.0,0.0],[-1.2,-3.5],[4.0,0.0],[4.2,0.4]],"o":[[0.6,0.1],[1.0,3.0],[-4.3,0.0],[0.0,0.0]],"c":false},{"v":[[-12.4,-0.9],[-13.0,-1.0],[-14.0,-5.0],[-10.0,-11.0],[-5.0,-12.0],[-1.0,-15.0]],"i":[[0.0,0.0],[0.2,0.0],[-0.06,1.4],[-2.29,1.16],[-2.3,0.9],[-1.04,1.35]],"o":[[-0.2,0.0],[-0.72,-1.21],[0.19,-2.56],[1.9,-0.9],[1.58,-0.62],[0.0,0.0]],"c":false},{"v":[[12.5,-0.3],[13.0,-1.0],[14.0,-6.0],[7.0,-9.0],[2.0,-4.0],[-4.2,-1.3]],"i":[[0.0,0.0],[-0.13,0.26],[0.7,2.1],[1.0,0.1],[1.98,-1.32],[2.22,-0.49]],"o":[[0.2,-0.21],[0.2,-0.2],[-1.0,-3.0],[-1.32,1.98],[-1.87,1.29],[0.0,0.0]],"c":false},{"v":[[-4.7,8.7],[3.8,6.3]],"i":[[0.0,0.0],[-2.68,1.26]],"o":[[2.95,-0.33],[0.0,0.0]],"c":false},{"v":[[-11.8,9.0],[-11.1,9.0]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false},{"v":[[14.0,-1.0],[18.0,1.0],[18.0,8.0],[8.0,14.0],[-13.0,19.0],[-22.0,14.0],[-11.8,9.0]],"i":[[0.0,0.0],[-1.04,-1.14],[2.5,-2.5],[3.79,-1.11],[6.0,0.0],[0.0,4.0],[-2.5,0.1]],"o":[[1.54,0.14],[1.3,1.7],[-2.77,2.82],[-6.0,2.0],[-5.1,0.0],[0.0,-4.4],[0.0,0.0]],"c":false}],"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.1,8.6],[-8.3,10.3],[-13.2,3.4],[-8.3,-3.5],[-3.4,3.4],[-5.1,8.6]],"i":[[0.0,0.0],[1.27,-0.04],[0.0,3.8],[-2.7,0.0],[0.0,-3.8],[1.12,-1.5]],"o":[[-0.75,1.03],[-2.7,0.0],[0.0,-3.8],[2.7,0.0],[0.02,1.87],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.44,"l":1},{"v":[[3.8,6.3],[3.2,2.9],[8.1,-4.0],[13.0,2.9],[8.1,9.8],[3.8,6.3]],"i":[[0.0,0.0],[-0.01,1.16],[-2.7,0.0],[0.0,-3.9],[2.7,0.0],[0.9,2.1]],"o":[[-0.41,-1.09],[0.0,-3.8],[2.7,0.0],[0.0,3.9],[-1.8,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.44,"l":1},{"v":[[10.1,3.0],[8.1,5.0],[6.1,3.0],[8.1,1.0],[10.1,3.0]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1},{"v":[[-6.3,3.4],[-8.3,5.4],[-10.3,3.4],[-8.3,1.4],[-6.3,3.4]],"i":[[0.0,0.0],[1.1,0.0],[0.0,1.1],[-1.1,0.0],[0.0,-1.1]],"o":[[0.0,1.1],[-1.1,0.0],[0.0,-1.1],[1.1,0.0],[0.0,0.0]],"c":false,"f":[0.0,0.0,0.0],"l":1}],"2728":[{"v":[[-10.29,4.11],[-8.33,5.77],[3.58,8.02],[3.59,8.82],[-8.33,11.08],[-10.29,12.73],[-13.45,30.23],[-14.55,30.23],[-17.7,12.73],[-19.66,11.08],[-31.58,8.82],[-31.58,8.02],[-19.66,5.76],[-18.34,3.82],[-15.69,-10.27],[-13.45,-13.39]],"i":[[-0.19,-1.08],[-1.04,-0.2],[0.0,0.0],[0.56,-0.11],[2.9,-0.55],[0.15,-0.8],[0.0,0.0],[0.09,0.48],[0.0,0.0],[1.04,0.2],[3.16,0.6],[-0.56,0.11],[-2.9,0.55],[-0.15,0.8],[0.0,0.0],[-0.09,-0.48]],"o":[[0.15,0.81],[0.0,0.0],[0.56,0.11],[-3.16,0.6],[-1.04,0.2],[0.0,0.0],[-0.09,0.48],[0.0,0.0],[-0.15,-0.81],[-2.9,-0.55],[-0.56,-0.11],[3.16,-0.6],[1.04,-0.2],[0.0,0.0],[0.09,-0.48],[0.98,5.44]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-13.35,30.23],[-11.77,14.82],[-16.94,2.0],[-18.3,4.12],[-20.12,5.78],[-31.18,8.03],[-31.18,8.84],[-20.12,11.09],[-17.3,12.74],[-14.37,30.23]],"i":[[-0.08,0.48],[0.0,0.0],[1.3,3.41],[0.0,0.0],[0.97,-0.2],[2.93,-0.6],[-0.52,-0.11],[-2.69,-0.55],[-0.13,-0.8],[0.0,0.0]],"o":[[0.0,0.0],[-2.8,-4.62],[0.0,0.0],[-0.13,0.8],[-2.69,0.55],[-0.52,0.11],[2.93,0.6],[0.97,0.2],[0.0,0.0],[0.08,0.48]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[10.68,-16.7],[12.1,-15.5],[20.7,-13.87],[20.7,-13.29],[12.09,-11.66],[10.68,-10.46],[8.4,2.17],[7.61,2.17],[5.33,-10.46],[3.91,-11.66],[-4.7,-13.29],[-4.7,-13.87],[3.91,-15.5],[4.86,-16.9],[6.66,-27.08],[8.4,-29.33]],"i":[[-0.14,-0.78],[-0.75,-0.14],[0.0,0.0],[0.4,-0.08],[2.1,-0.4],[0.1,-0.58],[0.0,0.0],[0.06,0.35],[0.0,0.0],[0.75,0.14],[2.28,0.43],[-0.4,0.08],[-2.1,0.4],[-0.1,0.58],[0.0,0.0],[-0.06,-0.35]],"o":[[0.1,0.58],[0.0,0.0],[0.4,0.08],[-2.28,0.43],[-0.75,0.14],[0.0,0.0],[-0.06,0.35],[0.0,0.0],[-0.1,-0.58],[-2.1,-0.4],[-0.4,-0.08],[2.28,-0.43],[0.75,-0.14],[0.0,0.0],[0.06,-0.35],[0.71,3.93]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[8.75,2.17],[9.61,-8.96],[5.15,-18.22],[4.9,-16.69],[3.58,-15.49],[-4.41,-13.86],[-4.41,-13.28],[3.58,-11.65],[5.9,-10.46],[8.01,2.17]],"i":[[-0.06,0.35],[0.0,0.0],[0.94,2.46],[0.0,0.0],[0.7,-0.14],[2.12,-0.43],[-0.37,-0.08],[-1.95,-0.4],[-0.1,-0.58],[0.0,0.0]],"o":[[0.0,0.0],[-2.02,-3.34],[0.0,0.0],[-0.1,0.58],[-1.95,0.4],[-0.37,0.08],[2.12,0.43],[0.7,0.14],[0.0,0.0],[0.06,0.35]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[20.88,12.94],[22.05,13.89],[29.12,15.19],[29.12,15.65],[22.05,16.95],[20.88,17.9],[19.01,27.98],[18.36,27.98],[16.49,17.9],[15.32,16.95],[8.25,15.65],[8.25,15.19],[15.32,13.89],[16.1,12.77],[17.58,4.65],[19.01,2.86]],"i":[[-0.12,-0.62],[-0.62,-0.11],[0.0,0.0],[0.33,-0.06],[1.72,-0.32],[0.09,-0.46],[0.0,0.0],[0.05,0.28],[0.0,0.0],[0.62,0.11],[1.88,0.34],[-0.33,0.06],[-1.72,0.32],[-0.09,0.46],[0.0,0.0],[-0.05,-0.28]],"o":[[0.09,0.46],[0.0,0.0],[0.33,0.06],[-1.88,0.34],[-0.62,0.11],[0.0,0.0],[-0.05,0.28],[0.0,0.0],[-0.09,-0.46],[-1.72,-0.32],[-0.33,-0.06],[1.88,-0.34],[0.62,-0.11],[0.0,0.0],[0.05,-0.28],[0.58,3.14]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[19.23,27.98],[20.29,19.11],[16.73,11.72],[16.53,12.94],[15.48,13.9],[9.1,15.19],[9.1,15.66],[15.48,16.96],[16.53,17.91],[18.65,27.98]],"i":[[-0.05,0.28],[0.0,0.0],[0.75,1.97],[0.0,0.0],[0.56,-0.11],[1.69,-0.34],[-0.3,-0.06],[-1.55,-0.32],[-0.08,-0.46],[0.0,0.0]],"o":[[0.0,0.0],[-1.61,-2.66],[0.0,0.0],[-0.08,0.46],[-1.55,0.32],[-0.3,0.06],[1.69,0.34],[0.56,0.11],[0.0,0.0],[0.05,0.28]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-16.0,-4.0],[-13.86,-15.16],[-13.16,-10.98],[-10.83,2.92],[-7.31,6.12],[4.0,8.42],[-7.32,10.72],[-10.83,13.92],[-13.86,32.0],[-16.89,13.92],[-20.4,10.72],[-31.72,8.42],[-20.4,6.12],[-17.0,2.0]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.88,-0.38],[0.0,0.0],[0.0,0.0],[0.26,-1.56],[0.0,0.0],[0.0,0.0],[1.87,0.38],[0.0,0.0],[0.0,0.0],[-0.26,1.56]],"o":[[0.0,0.0],[0.0,0.0],[0.11,0.67],[0.26,1.56],[0.0,0.0],[0.0,0.0],[-1.87,0.38],[0.0,0.0],[0.0,0.0],[-0.26,-1.56],[0.0,0.0],[0.0,0.0],[1.87,-0.38],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.56,-22.55],[8.1,-30.61],[8.61,-27.59],[10.29,-17.55],[12.83,-15.24],[21.0,-13.58],[12.83,-11.92],[10.29,-9.61],[8.1,3.45],[5.92,-9.61],[3.38,-11.92],[-4.8,-13.58],[3.38,-15.24],[5.83,-18.22]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.36,-0.28],[0.0,0.0],[0.0,0.0],[0.19,-1.13],[0.0,0.0],[0.0,0.0],[1.35,0.28],[0.0,0.0],[0.0,0.0],[-0.19,1.13]],"o":[[0.0,0.0],[0.0,0.0],[0.08,0.48],[0.19,1.13],[0.0,0.0],[0.0,0.0],[-1.35,0.28],[0.0,0.0],[0.0,0.0],[-0.19,-1.13],[0.0,0.0],[0.0,0.0],[1.35,-0.28],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[17.85,8.27],[19.08,1.84],[19.48,4.24],[20.83,12.25],[22.85,14.09],[29.37,15.42],[22.85,16.75],[20.83,18.59],[19.08,29.0],[17.34,18.59],[15.31,16.75],[8.8,15.42],[15.31,14.09],[17.27,11.72]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[-1.08,-0.22],[0.0,0.0],[0.0,0.0],[0.15,-0.9],[0.0,0.0],[0.0,0.0],[1.08,0.22],[0.0,0.0],[0.0,0.0],[-0.15,0.9]],"o":[[0.0,0.0],[0.0,0.0],[0.06,0.38],[0.15,0.9],[0.0,0.0],[0.0,0.0],[-1.08,0.22],[0.0,0.0],[0.0,0.0],[-0.15,-0.9],[0.0,0.0],[0.0,0.0],[1.08,-0.22],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F680":[{"v":[[12.46,-14.34],[14.57,-12.24],[12.46,-10.14],[10.36,-12.24]],"i":[[-1.16,0.0],[0.0,-1.16],[1.16,0.0],[0.0,1.16]],"o":[[1.16,0.0],[0.0,1.16],[-1.16,0.0],[0.0,-1.16]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-19.88,12.11],[-23.85,23.8],[-12.17,19.83],[-8.2,8.14]],"i":[[3.16,-3.16],[-0.68,-4.13],[-3.16,3.16],[0.68,4.13]],"o":[[-3.16,3.16],[4.13,0.68],[3.16,-3.16],[-4.13,-0.68]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-4.03,9.84],[-5.39,12.39],[-6.53,13.24],[-1.84,22.99],[0.2,21.02],[5.05,14.19],[7.8,6.56],[-4.03,9.84]],"i":[[0.0,0.0],[0.7,-0.7],[0.42,-0.23],[-0.94,-3.47],[-0.65,0.69],[-1.3,2.49],[-0.57,2.64],[4.05,-0.21]],"o":[[-0.19,0.97],[-0.34,0.34],[2.16,2.97],[0.71,-0.62],[1.91,-2.03],[1.25,-2.42],[-3.73,1.95],[0.0,0.0]],"c":true,"f":[0.3804,0.698,0.8941]},{"v":[[-21.08,-0.25],[-23.05,1.79],[-13.29,6.47],[-12.44,5.34],[-9.9,3.98],[-6.61,-7.84],[-6.6,-7.85],[-14.24,-5.1],[-21.08,-0.25]],"i":[[0.0,0.0],[0.62,-0.71],[-2.98,-2.16],[-0.33,0.33],[-0.96,0.19],[-1.96,3.72],[-0.0,0.0],[2.42,-1.25],[2.03,-1.91]],"o":[[-0.69,0.65],[3.47,0.93],[0.23,-0.41],[0.69,-0.69],[0.21,-4.05],[0.0,-0.0],[-2.64,0.57],[-2.5,1.3],[0.0,0.0]],"c":true,"f":[0.5725,0.8275,0.9608]},{"p":[{"v":[[-1.18,-15.25],[-9.9,3.98],[-5.39,5.34],[-4.03,9.87],[15.21,1.13],[23.64,-23.71],[18.35,-24.02],[-1.18,-15.25]],"i":[[0.0,0.0],[0.36,-7.07],[-1.18,-1.18],[0.34,-1.64],[-5.25,5.24],[1.45,8.77],[1.79,-0.07],[5.32,-5.32]],"o":[[-5.23,5.25],[1.64,-0.33],[1.19,1.19],[7.08,-0.36],[6.71,-6.72],[-1.73,-0.28],[-7.17,0.29],[0.0,0.0]],"c":true},{"v":[[9.07,-15.78],[15.74,-15.78],[15.74,-15.78],[15.74,-9.12],[15.74,-9.11],[9.07,-9.12]],"i":[[-1.84,1.84],[-1.84,-1.84],[-0.0,-0.0],[1.84,-1.84],[0.0,-0.0],[1.84,1.84]],"o":[[1.84,-1.84],[0.0,0.0],[1.84,1.84],[-0.0,0.0],[-1.84,1.84],[-1.84,-1.84]],"c":true}],"f":[0.9176,0.3529,0.2784]},{"v":[[-9.46,16.04],[-12.47,18.6],[-23.91,20.25],[-23.85,23.8],[-12.17,19.82],[-9.46,16.04]],"i":[[0.0,0.0],[1.12,-0.72],[3.72,1.18],[-0.19,-1.16],[-3.16,3.16],[-0.68,1.39]],"o":[[-0.88,0.98],[-3.49,2.22],[-0.15,1.2],[4.13,0.68],[1.1,-1.11],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[-9.8,2.69],[-9.86,3.97],[-5.39,5.34],[-4.03,9.87],[15.21,1.13],[19.18,-3.8],[14.83,-0.5],[-9.8,2.69]],"i":[[0.0,0.0],[0.01,-0.43],[-1.17,-1.17],[0.34,-1.64],[-5.25,5.24],[-1.15,1.77],[1.55,-0.97],[7.93,2.71]],"o":[[-0.03,0.43],[1.63,-0.32],[1.19,1.19],[7.07,-0.36],[1.49,-1.51],[-1.35,1.23],[-7.56,4.71],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-11.96,12.55],[-9.41,11.11],[-2.78,5.56],[-2.78,5.55],[1.95,-1.36],[2.06,-1.74],[-11.96,12.55]],"i":[[0.0,0.0],[-0.83,0.52],[-1.95,2.15],[0.0,0.0],[-1.26,2.49],[-0.01,0.13],[-0.83,-4.04]],"o":[[0.87,-0.44],[2.44,-1.53],[0.0,0.0],[1.88,-2.09],[0.06,-0.12],[-3.4,-0.75],[0.0,0.0]],"c":true,"f":[0.3804,0.698,0.8941]},{"p":[{"v":[[12.41,-6.51],[6.46,-12.45],[12.41,-18.39],[18.35,-12.45]],"i":[[3.28,0.0],[0.0,3.28],[-3.28,0.0],[0.0,-3.28]],"o":[[-3.28,0.0],[0.0,-3.28],[3.28,0.0],[0.0,3.28]],"c":true},{"v":[[12.41,-16.41],[8.44,-12.45],[12.41,-8.49],[16.37,-12.45]],"i":[[2.18,0.0],[0.0,-2.18],[-2.18,0.0],[0.0,2.18]],"o":[[-2.18,0.0],[0.0,2.18],[2.18,0.0],[0.0,-2.18]],"c":true}],"f":[0.0,0.0,0.0],"l":1},{"v":[[-15.35,9.06],[-19.88,12.11],[-23.85,23.8],[-12.17,19.82],[-9.11,15.29]],"i":[[0.0,0.0],[1.31,-1.3],[-0.68,-4.13],[-3.16,3.16],[-0.71,1.68]],"o":[[-1.68,0.71],[-3.16,3.16],[4.13,0.68],[1.3,-1.31],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-21.08,-0.25],[-23.05,1.79],[-13.29,6.47],[-12.44,5.34],[-9.9,3.98],[-6.61,-7.84],[-6.6,-7.85],[-14.24,-5.1],[-21.08,-0.25]],"i":[[0.0,0.0],[0.62,-0.71],[-2.98,-2.16],[-0.33,0.33],[-0.96,0.19],[-1.96,3.72],[-0.0,0.0],[2.42,-1.25],[2.03,-1.91]],"o":[[-0.69,0.65],[3.47,0.93],[0.23,-0.41],[0.69,-0.69],[0.21,-4.05],[0.0,-0.0],[-2.64,0.57],[-2.5,1.3],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-4.03,9.84],[-5.39,12.39],[-6.53,13.24],[-1.84,22.99],[0.2,21.02],[5.05,14.19],[7.8,6.56],[-4.03,9.84]],"i":[[0.0,0.0],[0.7,-0.7],[0.42,-0.23],[-0.94,-3.47],[-0.65,0.69],[-1.3,2.49],[-0.57,2.64],[4.05,-0.21]],"o":[[-0.19,0.97],[-0.34,0.34],[2.16,2.97],[0.71,-0.62],[1.91,-2.03],[1.25,-2.42],[-3.73,1.95],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[-4.17,7.34],[-4.03,9.87],[15.21,1.13],[23.65,-23.71],[-1.18,-15.25],[-9.9,3.98],[-7.13,4.22]],"i":[[0.0,0.0],[0.11,-0.83],[-5.25,5.24],[1.45,8.77],[6.72,-6.71],[0.36,-7.07],[-0.87,-0.33]],"o":[[0.27,0.89],[7.08,-0.36],[6.71,-6.72],[-8.77,-1.44],[-5.23,5.25],[0.94,-0.19],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1},{"v":[[1.07,-1.8],[1.07,-1.8],[-5.63,2.78],[-11.01,9.2],[-12.4,11.67]],"i":[[0.0,0.0],[0.0,0.0],[2.03,-1.82],[1.48,-2.37],[0.42,-0.84]],"o":[[0.0,0.0],[-2.42,1.22],[-2.08,1.89],[-0.5,0.8],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":1.95,"lc":2,"lj":2,"l":1}],"2705":[{"v":[[17.19,16.84],[-15.42,16.84],[-16.1,16.18],[-16.1,-15.5],[-15.42,-16.16],[6.09,-16.16],[7.38,-16.16],[9.39,-16.16],[16.06,-16.16],[17.19,-16.16],[17.87,-15.5],[17.87,16.18]],"i":[[0.38,0.0],[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.38,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0]],"o":[[0.0,0.0],[-0.38,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.38,0.0],[0.0,0.0],[-0.0,0.36]],"c":true,"f":[0.6941,0.8,0.2]},{"v":[[-5.34,-5.46],[-9.66,-2.94],[-1.75,11.44],[3.08,11.44],[23.76,-21.56],[21.24,-25.88],[0.01,3.37]],"i":[[2.02,2.84],[-1.86,-2.63],[-2.04,-5.13],[-0.6,2.65],[-12.47,5.83],[2.9,-1.35],[3.55,-11.89]],"o":[[-1.85,-2.61],[3.19,4.51],[0.84,2.09],[2.83,-12.6],[2.91,-1.36],[-11.43,5.35],[-1.56,-3.05]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[17.0,-13.36],[17.0,17.12],[16.34,17.78],[-15.34,17.78],[-16.0,17.12],[-16.0,-14.56],[-15.34,-15.22],[4.74,-15.22],[5.31,-15.22]],"i":[[0.0,0.0],[0.0,0.0],[0.36,0.0],[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.36,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.36],[0.0,0.0],[-0.36,0.0],[0.0,0.0],[0.0,-0.36],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-5.34,-5.46],[-9.66,-2.94],[-1.75,11.44],[3.08,11.44],[23.76,-21.56],[21.24,-25.88],[0.01,3.37]],"i":[[2.02,2.84],[-1.86,-2.63],[-2.04,-5.13],[-0.6,2.65],[-12.47,5.83],[2.9,-1.35],[3.55,-11.89]],"o":[[-1.85,-2.61],[3.19,4.51],[0.84,2.09],[2.83,-12.6],[2.91,-1.36],[-11.43,5.35],[-1.56,-3.05]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"26A0":[{"v":[[-3.48,-22.99],[0.0,-25.02],[3.48,-22.99],[24.45,18.94],[25.0,20.95],[20.97,24.98],[-20.97,25.0],[-25.0,20.97],[-24.45,18.96],[-3.48,-22.99]],"i":[[0.0,0.0],[-1.49,0.0],[-0.7,-1.2],[0.0,0.0],[0.0,-0.73],[2.23,0.0],[0.0,0.0],[0.0,2.23],[-0.34,0.59],[0.0,0.0]],"o":[[0.7,-1.2],[1.49,0.0],[0.0,0.0],[0.34,0.59],[0.0,2.23],[0.0,0.0],[-2.23,0.0],[0.0,-0.74],[0.0,0.0],[0.0,0.0]],"c":false,"f":[0.9882,0.9176,0.1686]},{"v":[[1.61,11.27],[0.0,12.88],[-1.61,11.27],[-1.61,-12.11],[0.0,-13.72],[1.61,-12.11]],"i":[[0.0,0.0],[0.89,0.0],[0.0,0.89],[0.0,0.0],[-0.89,0.0],[0.0,-0.89]],"o":[[0.0,0.89],[-0.89,0.0],[0.0,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.0]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[0.0,16.92],[1.61,18.53],[0.0,20.14],[-1.61,18.53]],"i":[[-0.89,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.89]],"o":[[0.89,0.0],[0.0,0.89],[-0.89,0.0],[0.0,-0.89]],"c":true,"f":[1.0,1.0,1.0]},{"v":[[-3.48,-22.99],[0.0,-25.02],[3.48,-22.99],[24.45,18.94],[25.0,20.95],[20.97,24.98],[-20.97,25.0],[-25.0,20.97],[-24.45,18.96],[-3.48,-22.99]],"i":[[0.0,0.0],[-1.49,0.0],[-0.7,-1.2],[0.0,0.0],[0.0,-0.73],[2.23,0.0],[0.0,0.0],[0.0,2.23],[-0.34,0.59],[0.0,0.0]],"o":[[0.7,-1.2],[1.49,0.0],[0.0,0.0],[0.34,0.59],[0.0,2.23],[0.0,0.0],[-2.23,0.0],[0.0,-0.74],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[1.61,11.27],[0.0,12.88],[-1.61,11.27],[-1.61,-12.11],[0.0,-13.72],[1.61,-12.11]],"i":[[0.0,0.0],[0.89,0.0],[0.0,0.89],[0.0,0.0],[-0.89,0.0],[0.0,-0.89]],"o":[[0.0,0.89],[-0.89,0.0],[0.0,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.0]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[0.0,16.92],[1.61,18.53],[0.0,20.14],[-1.61,18.53]],"i":[[-0.89,0.0],[0.0,-0.89],[0.89,0.0],[0.0,0.89]],"o":[[0.89,0.0],[0.0,0.89],[-0.89,0.0],[0.0,-0.89]],"c":true,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}],"1F389":[{"v":[[-9.82,-15.82],[2.75,-3.25],[15.32,9.32],[-6.21,18.28],[-27.74,27.24],[-18.78,5.71]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[4.0,-1.0],[-10.31,-15.33],[-19.61,6.54],[-28.91,28.41]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9882,0.9176,0.1686]},{"v":[[-20.78,9.28],[-9.71,20.35],[-15.25,22.6],[-23.04,14.8]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-18.66,19.25],[-15.25,22.6],[-9.71,20.35],[-14.52,15.55]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-15.2,-3.84],[-8.5,2.86],[3.2,14.56],[-3.07,17.42],[-11.24,9.25],[-17.85,2.64]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.9176,0.3529,0.2784]},{"v":[[-9.46,11.03],[-3.07,17.42],[3.2,14.56],[-4.64,6.72]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[-5.7,-23.51],[-3.7,-21.54],[-5.7,-19.57],[-7.7,-21.54]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.5373,0.4039,0.6667]},{"v":[[24.3,-19.51],[26.3,-17.54],[24.3,-15.57],[22.3,-17.54]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.9451,0.702,0.1098]},{"v":[[21.3,1.49],[23.3,3.46],[21.3,5.43],[19.3,3.46]],"i":[[-1.1,0.0],[0.0,-1.09],[1.1,0.0],[0.0,1.09]],"o":[[1.1,0.0],[0.0,1.09],[-1.1,0.0],[0.0,-1.09]],"c":true,"f":[0.8235,0.1843,0.1529]},{"v":[[14.66,9.64],[14.83,9.81],[-7.04,19.11],[-28.91,28.41],[-19.61,6.54],[-10.31,-15.33]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.2,-15.22],[2.26,-2.76],[14.66,9.64]],"i":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[-10.31,-15.33],[-10.2,-15.22]],"i":[[0.0,0.0],[0.0,0.0]],"o":[[0.0,0.0],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[10.49,-28.63],[10.98,-27.16],[6.74,-21.2]],"i":[[0.0,0.0],[-0.09,-0.53],[2.79,-0.54]],"o":[[0.23,0.45],[0.45,2.75],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[6.93,-21.22],[5.42,-20.86],[2.61,-14.11]],"i":[[0.0,0.0],[0.5,-0.21],[-1.02,-2.66]],"o":[[-0.5,0.04],[-2.57,1.07],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[25.79,-9.28],[25.25,-7.83],[18.21,-5.85]],"i":[[0.0,0.0],[0.26,-0.47],[2.51,1.33]],"o":[[-0.1,0.5],[-1.37,2.42],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1},{"v":[[18.37,-5.74],[16.97,-6.41],[10.55,-2.91]],"i":[[0.0,0.0],[0.52,0.15],[0.87,-2.71]],"o":[[-0.42,-0.29],[-2.67,-0.78],[0.0,0.0]],"c":false,"s":[0.0,0.0,0.0],"sw":2.0,"lc":2,"lj":2,"l":1}]};

    // =========================================================================
    // 3. EMOJI SOURCES & SUBFOLDER (/emojis/*.json) LOADER
    // =========================================================================
    var EMOJI_SOURCES = [
        {
            id: "openmoji_color",
            index: 1,
            label: "OpenMoji Color (hfg-gmuend/openmoji)",
            shortName: "OpenMoji Color",
            file: "openmoji_color.json",
            repo: "https://github.com/hfg-gmuend/openmoji"
        },
        {
            id: "twemoji_color",
            index: 2,
            label: "Twemoji Flat Color (jdecked/twemoji)",
            shortName: "Twemoji Flat",
            file: "twemoji_color.json",
            repo: "https://github.com/jdecked/twemoji"
        },
        {
            id: "openmoji_flat",
            index: 3,
            label: "OpenMoji Flat (Color Only, No Outlines)",
            shortName: "OpenMoji Flat",
            file: "openmoji_color.json",
            repo: "https://github.com/hfg-gmuend/openmoji"
        },
        {
            id: "openmoji_black",
            index: 4,
            label: "OpenMoji Black (Line Art / Wireframe)",
            shortName: "OpenMoji Black",
            file: "openmoji_black.json",
            repo: "https://github.com/hfg-gmuend/openmoji"
        }
    ];

    var CATEGORY_FILTERS = [
        { id: "all", label: "All Categories" },
        { id: "emoticons", label: "Wikipedia Emoticons (:D, :), <3, XD...)" },
        { id: "smileys-emotion", label: "Smileys & Emotion" },
        { id: "people-body", label: "People & Gestures" },
        { id: "symbols", label: "Hearts & Symbols" },
        { id: "animals-nature", label: "Animals & Nature" },
        { id: "food-drink", label: "Food & Drink" },
        { id: "activities-objects", label: "Activities, Travel & Objects" }
    ];

    var customEmojisFolderPath = null;
    var emojiCatalog = [];
    var emojiByHex = {};
    var emojiByInt = {};
    var emojiByIndex = {};
    var wikiEmoticonMap = {};
    var wikiEntries = [];
    var shapeDatabases = {
        openmoji_color: {},
        twemoji_color: {},
        openmoji_black: {}
    };

    function getEmojisFolder() {
        if (typeof Folder === "undefined") return null;
        try {
            if (customEmojisFolderPath) {
                var customFolder = new Folder(customEmojisFolderPath);
                if (customFolder.exists) return customFolder;
            }
            if (typeof $ !== "undefined" && $.fileName) {
                var scriptFile = new File($.fileName);
                if (scriptFile && scriptFile.parent && scriptFile.parent.exists) {
                    var sub = new Folder(scriptFile.parent.fsName + "/emojis");
                    if (!sub.exists) {
                        try { sub.create(); } catch (eCreate) {}
                    }
                    return sub;
                }
            }
        } catch (e) {}
        return null;
    }

    function ensureDiskJSONFiles() {
        var folder = getEmojisFolder();
        if (!folder || typeof File === "undefined") return;
        try {
            var idxFile = new File(folder.fsName + "/emoji_index.json");
            if (!idxFile.exists) {
                idxFile.encoding = "UTF-8";
                if (idxFile.open("w")) {
                    idxFile.write(JSONPolyfill.stringify(FALLBACK_INDEX_DATA));
                    idxFile.close();
                }
            }
            var wikiFile = new File(folder.fsName + "/wikipedia_emoticons.json");
            if (!wikiFile.exists) {
                wikiFile.encoding = "UTF-8";
                if (wikiFile.open("w")) {
                    wikiFile.write(JSONPolyfill.stringify(FALLBACK_WIKI_DATA));
                    wikiFile.close();
                }
            }
            var omFile = new File(folder.fsName + "/openmoji_color.json");
            if (!omFile.exists) {
                omFile.encoding = "UTF-8";
                if (omFile.open("w")) {
                    omFile.write(JSONPolyfill.stringify(FALLBACK_SHAPES_DATA));
                    omFile.close();
                }
            }
        } catch (e) {}
    }

    function loadJSONFromEmojisSubfolder(filename) {
        // 1. Browser / AE_JS_builder environment: synchronous XHR from jsx/emojis/ or emojis/
        if (typeof XMLHttpRequest !== "undefined") {
            var candidateUrls = [
                "jsx/emojis/" + filename,
                "emojis/" + filename,
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

        // 2. Desktop Adobe After Effects ExtendScript: read from /emojis/ subfolder
        if (typeof File !== "undefined") {
            try {
                ensureDiskJSONFiles();
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
        emojiCatalog = (idxData && idxData.emojis && idxData.emojis.length) ? idxData.emojis : FALLBACK_INDEX_DATA.emojis;
        emojiByHex = {};
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
            emojiByInt[item.unicodeInt] = item;
            emojiByIndex[item.index] = item;
        }

        var wData = wikiData || FALLBACK_WIKI_DATA;
        wikiEmoticonMap = {};
        wikiEntries = (wData && wData.entries) ? wData.entries : [];

        if (wData && wData.lookup) {
            for (var k in wData.lookup) {
                if (wData.lookup.hasOwnProperty(k)) {
                    wikiEmoticonMap[k] = String(wData.lookup[k]).toUpperCase();
                    wikiEmoticonMap[k.toLowerCase()] = String(wData.lookup[k]).toUpperCase();
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

    // =========================================================================
    // 4. BUILT-IN LIVE SVG PARSER (For Custom Codepoints / On-the-Fly SVG Load)
    // =========================================================================
    var KAPPA = 0.55228474983;

    function parseSvgColor(val) {
        if (!val) return null;
        var v = trimStr(val).toLowerCase();
        if (v === "none" || v === "transparent") return null;
        if (v === "black") return [0, 0, 0];
        if (v === "white") return [1, 1, 1];
        if (v.charAt(0) === "#") {
            var h = v.substring(1);
            if (h.length === 3) {
                h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
            }
            if (h.length >= 6) {
                return [
                    Math.round((parseInt(h.substring(0, 2), 16) / 255) * 1000) / 1000,
                    Math.round((parseInt(h.substring(2, 4), 16) / 255) * 1000) / 1000,
                    Math.round((parseInt(h.substring(4, 6), 16) / 255) * 1000) / 1000
                ];
            }
        }
        return null;
    }

    function getShapesForEmoji(hexcode, sourceId) {
        var hc = String(hexcode || "1F603").toUpperCase();
        var src = sourceId || "openmoji_color";

        if (src === "twemoji_color") {
            if (shapeDatabases.twemoji_color && shapeDatabases.twemoji_color[hc]) {
                return shapeDatabases.twemoji_color[hc];
            }
        } else if (src === "openmoji_black") {
            if (shapeDatabases.openmoji_black && shapeDatabases.openmoji_black[hc]) {
                return shapeDatabases.openmoji_black[hc];
            }
        } else if (src === "openmoji_flat") {
            var baseShapes = (shapeDatabases.openmoji_color && shapeDatabases.openmoji_color[hc]) || FALLBACK_SHAPES_DATA[hc];
            if (baseShapes && baseShapes.length) {
                var flatFiltered = [];
                for (var i = 0; i < baseShapes.length; i++) {
                    if (!baseShapes[i].l) {
                        flatFiltered.push(baseShapes[i]);
                    }
                }
                return flatFiltered.length > 0 ? flatFiltered : baseShapes;
            }
        }

        if (shapeDatabases.openmoji_color && shapeDatabases.openmoji_color[hc]) {
            return shapeDatabases.openmoji_color[hc];
        }
        if (FALLBACK_SHAPES_DATA[hc]) {
            return FALLBACK_SHAPES_DATA[hc];
        }
        return FALLBACK_SHAPES_DATA["1F603"];
    }

    // =========================================================================
    // 5. SEARCH & RESOLUTION ENGINE (Name, Unicode, Integer, Glyph, Emoticon)
    // =========================================================================
    function matchesCategoryFilter(entry, categoryId) {
        if (!categoryId || categoryId === "all") return true;
        if (categoryId === "emoticons") {
            return (entry.emoticons && entry.emoticons.length > 0);
        }
        var grp = String(entry.group || "").toLowerCase();
        if (categoryId === "smileys-emotion") {
            return grp.indexOf("smiley") >= 0 || grp.indexOf("emotion") >= 0;
        }
        if (categoryId === "people-body") {
            return grp.indexOf("people") >= 0 || grp.indexOf("body") >= 0;
        }
        if (categoryId === "symbols") {
            return grp.indexOf("symbol") >= 0 || (entry.name && entry.name.toLowerCase().indexOf("heart") >= 0);
        }
        if (categoryId === "animals-nature") {
            return grp.indexOf("animal") >= 0 || grp.indexOf("nature") >= 0;
        }
        if (categoryId === "food-drink") {
            return grp.indexOf("food") >= 0 || grp.indexOf("drink") >= 0;
        }
        if (categoryId === "activities-objects") {
            return grp.indexOf("activit") >= 0 || grp.indexOf("object") >= 0 || grp.indexOf("travel") >= 0;
        }
        return true;
    }

    function searchEmojis(rawQuery, categoryId) {
        var q = trimStr(rawQuery);
        var qLower = q.toLowerCase();
        var results = [];
        var exactMatches = [];

        // 1. Check exact Wikipedia Emoticon match first (e.g. ":D", ":)", "<3", "XD", "¯\_(ツ)_/¯")
        if (q && wikiEmoticonMap.hasOwnProperty(q)) {
            var emoHex = wikiEmoticonMap[q];
            if (emojiByHex[emoHex]) {
                exactMatches.push(emojiByHex[emoHex]);
            }
        } else if (q && wikiEmoticonMap.hasOwnProperty(qLower)) {
            var emoHexLower = wikiEmoticonMap[qLower];
            if (emojiByHex[emoHexLower]) {
                exactMatches.push(emojiByHex[emoHexLower]);
            }
        }

        // 2. Check direct Emoji Glyph character input (e.g. "😃", "🔥", "❤️")
        if (q && q.length <= 4) {
            var cpInt = glyphToCodePointInt(q);
            if (cpInt > 127 && emojiByInt[cpInt]) {
                var glyphEntry = emojiByInt[cpInt];
                if (exactMatches.indexOf(glyphEntry) < 0) {
                    exactMatches.push(glyphEntry);
                }
            }
        }

        // 3. Check Unicode Hex ("U+1F603", "0x1F603", "1F603") or Integer ("128515")
        if (q) {
            if (/^(U\+|0X)[0-9A-F\-]+$/i.test(q)) {
                var cleanHex = q.replace(/^(U\+|0X)/i, "").toUpperCase();
                if (emojiByHex[cleanHex] && exactMatches.indexOf(emojiByHex[cleanHex]) < 0) {
                    exactMatches.push(emojiByHex[cleanHex]);
                }
            } else if (/^\d{4,6}$/.test(q)) {
                var asDecInt = parseInt(q, 10);
                if (emojiByInt[asDecInt] && exactMatches.indexOf(emojiByInt[asDecInt]) < 0) {
                    exactMatches.push(emojiByInt[asDecInt]);
                }
                var asHexUpper = q.toUpperCase();
                if (emojiByHex[asHexUpper] && exactMatches.indexOf(emojiByHex[asHexUpper]) < 0) {
                    exactMatches.push(emojiByHex[asHexUpper]);
                }
            } else if (/^[0-9A-F]{4,5}$/i.test(q)) {
                var hexCandidate = q.toUpperCase();
                if (emojiByHex[hexCandidate] && exactMatches.indexOf(emojiByHex[hexCandidate]) < 0) {
                    exactMatches.push(emojiByHex[hexCandidate]);
                }
            }
        }

        // 4. Filter catalog by query & category
        for (var i = 0; i < emojiCatalog.length; i++) {
            var entry = emojiCatalog[i];
            if (!matchesCategoryFilter(entry, categoryId)) continue;

            if (!q) {
                results.push(entry);
                continue;
            }

            if (exactMatches.indexOf(entry) >= 0) continue;

            var matched = false;
            var nameLower = String(entry.name || "").toLowerCase();
            var hexLower = String(entry.hexcode || "").toLowerCase();
            var intStr = String(entry.unicodeInt || "");

            if (nameLower.indexOf(qLower) >= 0 || hexLower.indexOf(qLower.replace(/^u\+/i, "")) >= 0 || intStr.indexOf(q) >= 0) {
                matched = true;
            }
            if (!matched && entry.emoji === q) {
                matched = true;
            }
            if (!matched && entry.emoticons) {
                for (var em = 0; em < entry.emoticons.length; em++) {
                    var emoToken = String(entry.emoticons[em]);
                    if (emoToken === q || emoToken.toLowerCase().indexOf(qLower) >= 0) {
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched && entry.tags) {
                for (var tg = 0; tg < entry.tags.length; tg++) {
                    if (String(entry.tags[tg]).toLowerCase().indexOf(qLower) >= 0) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) {
                results.push(entry);
            }
        }

        return exactMatches.concat(results);
    }

    function findNearestEmojiByUnicodeInt(targetInt) {
        var n = Math.round(Number(targetInt) || 128515);
        if (emojiByInt[n]) return emojiByInt[n];
        var best = emojiCatalog[0];
        var bestDist = Math.abs((best ? best.unicodeInt : 128515) - n);
        for (var i = 1; i < emojiCatalog.length; i++) {
            var d = Math.abs(emojiCatalog[i].unicodeInt - n);
            if (d < bestDist) {
                bestDist = d;
                best = emojiCatalog[i];
            }
        }
        return best;
    }

    // =========================================================================
    // 6. AFTER EFFECTS SHAPE LAYER BUILDER & REPLACER
    // =========================================================================
    function isEmojiLayer(layer) {
        if (!layer) return false;
        try {
            var nm = String(layer.name || "");
            if (nm.indexOf("Emoji ") === 0 || nm.indexOf("Emoji_") === 0) return true;
            var fx = layer.property("ADBE Effect Parade") || layer.effects;
            if (fx && fx.property("Emoji Unicode Int")) return true;
        } catch (e) {}
        return false;
    }

    function getSelectedEmojiLayer(comp) {
        if (!comp) return null;
        try {
            var sel = comp.selectedLayers;
            if (sel && sel.length > 0) {
                for (var i = 0; i < sel.length; i++) {
                    if (isEmojiLayer(sel[i])) return sel[i];
                }
                // Also allow replacing if any ShapeLayer is explicitly selected
                if (sel[0] && sel[0].property && sel[0].property("ADBE Root Vectors Group")) {
                    if (isEmojiLayer(sel[0])) return sel[0];
                }
            }
        } catch (e) {}
        return null;
    }

    function getAnyExistingEmojiLayer(comp) {
        var sel = getSelectedEmojiLayer(comp);
        if (sel) return sel;
        if (!comp) return null;
        try {
            var count = (typeof comp.numLayers === "number") ? comp.numLayers : (comp.layers ? comp.layers.length : 0);
            for (var i = 1; i <= count; i++) {
                var lyr = comp.layer ? comp.layer(i) : comp.layers[i - 1];
                if (isEmojiLayer(lyr)) return lyr;
            }
        } catch (e) {}
        return null;
    }

    function countEmojiLayersInComp(comp) {
        if (!comp) return 0;
        var total = 0;
        try {
            var count = (typeof comp.numLayers === "number") ? comp.numLayers : (comp.layers ? comp.layers.length : 0);
            for (var i = 1; i <= count; i++) {
                var lyr = comp.layer ? comp.layer(i) : comp.layers[i - 1];
                if (isEmojiLayer(lyr)) total++;
            }
        } catch (e) {}
        return total;
    }

    function ensureEffectSlider(fxGroup, name, defaultVal) {
        var eff = fxGroup.property(name);
        if (!eff) {
            eff = fxGroup.addProperty("ADBE Slider Control");
            eff.name = name;
        }
        try {
            eff.property("ADBE Slider Control-0001").setValue(defaultVal);
        } catch (e) {
            try { eff.property("Slider").setValue(defaultVal); } catch (e2) {}
        }
        return eff;
    }

    function ensureEffectCheckbox(fxGroup, name, defaultVal) {
        var eff = fxGroup.property(name);
        if (!eff) {
            eff = fxGroup.addProperty("ADBE Checkbox Control");
            eff.name = name;
        }
        try {
            eff.property("ADBE Checkbox Control-0001").setValue(defaultVal ? 1 : 0);
        } catch (e) {
            try { eff.property("Checkbox").setValue(defaultVal ? 1 : 0); } catch (e2) {}
        }
        return eff;
    }

    function clearRootVectorContents(rootVectors) {
        if (!rootVectors) return;
        try {
            if (typeof rootVectors.numProperties === "number") {
                for (var i = rootVectors.numProperties; i >= 1; i--) {
                    try { rootVectors.property(i).remove(); } catch (eRem) {}
                }
            }
            if (rootVectors.properties && rootVectors.properties.length > 0) {
                rootVectors.properties.length = 0;
            }
        } catch (e) {}
    }

    function populateEmojiVectorShapes(shapeLayer, entry, sourceId, sizePx, outlinePct, showOutlines) {
        var rootVectors = shapeLayer.property("ADBE Root Vectors Group");
        if (!rootVectors) return;

        clearRootVectorContents(rootVectors);

        var masterGrp = rootVectors.addProperty("ADBE Vector Group");
        masterGrp.name = "Emoji_Master (" + entry.unicode + " = " + entry.unicodeInt + ")";
        var masterContents = masterGrp.property("ADBE Vectors Group");

        var shapes = getShapesForEmoji(entry.hexcode, sourceId);
        var inBrowser = isBrowserSim();

        // In browser SVG renderer, index 0 is rendered first (back-to-front).
        // In desktop After Effects Shape Layer stack, index 1 is rendered on top (front-to-back).
        var startIdx = inBrowser ? 0 : (shapes.length - 1);
        var endIdx = inBrowser ? shapes.length : -1;
        var step = inBrowser ? 1 : -1;

        for (var idx = startIdx; idx !== endIdx; idx += step) {
            var item = shapes[idx];
            var isLine = Boolean(item.l) && (sourceId !== "openmoji_black");
            if (isLine && !showOutlines && inBrowser) {
                // Still create the group so toggling Show Outlines works dynamically
            }

            var partGrp = masterContents.addProperty("ADBE Vector Group");
            partGrp.name = (item.l ? "Outline_" : "Color_") + (idx + 1);
            var partVecs = partGrp.property("ADBE Vectors Group");

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
                if (item.lc) {
                    try { strokeProp.property("ADBE Vector Stroke Line Cap").setValue(item.lc); } catch (eLc) {}
                }
                if (item.lj) {
                    try { strokeProp.property("ADBE Vector Stroke Line Join").setValue(item.lj); } catch (eLj) {}
                }
                if (isLine) {
                    try {
                        strokeProp.property("ADBE Vector Stroke Width").expression =
                            "try { value * (effect('Outline Width %')('Slider') / 100); } catch(e) { value; }";
                    } catch (eSwExpr) {}
                }
            }

            if (isLine) {
                var partTr = partGrp.property("ADBE Vector Transform Group");
                if (partTr && partTr.property("ADBE Vector Opacity")) {
                    partTr.property("ADBE Vector Opacity").setValue(showOutlines ? 100 : 0);
                    try {
                        partTr.property("ADBE Vector Opacity").expression =
                            "try { (effect('Show Outlines')('Checkbox') > 0) ? 100 : 0; } catch(e) { value; }";
                    } catch (eOpExpr) {}
                }
            }
        }

        // Rig Master Vector Group Scale to "Emoji Size (px)" (base coordinate space is 72x72)
        var masterTr = masterGrp.property("ADBE Vector Transform Group");
        if (masterTr) {
            masterTr.property("ADBE Vector Anchor").setValue([0, 0]);
            masterTr.property("ADBE Vector Position").setValue([0, 0]);
            var scalePct = Math.round((sizePx / 72.0) * 10000) / 100;
            masterTr.property("ADBE Vector Scale").setValue([scalePct, scalePct]);
            try {
                masterTr.property("ADBE Vector Scale").expression = [
                    "try {",
                    "  var sz = effect('Emoji Size (px)')('Slider');",
                    "  var s = (sz / 72.0) * 100.0;",
                    "  [s, s];",
                    "} catch(e) { value; }"
                ].join("\n");
            } catch (eScExpr) {}
        }
    }

    function applyEmojiToLayer(comp, targetLayer, entry, sourceObj, sizePx, outlinePct, showOutlines, isReplacing) {
        var shapeLayer = targetLayer;
        var existingCount = countEmojiLayersInComp(comp);

        if (!shapeLayer) {
            shapeLayer = comp.layers.addShape();
            var tr = shapeLayer.property("ADBE Transform Group");
            if (tr) {
                tr.property("ADBE Anchor Point").setValue([0, 0, 0]);
                // Place first emoji at comp center; offset subsequent added emojis neatly in a grid
                var cx = comp.width / 2;
                var cy = comp.height / 2;
                if (existingCount > 0) {
                    var col = existingCount % 5;
                    var row = Math.floor(existingCount / 5);
                    cx = (comp.width * 0.2) + col * (comp.width * 0.15);
                    cy = (comp.height * 0.3) + (row % 3) * (comp.height * 0.2);
                }
                tr.property("ADBE Position").setValue([Math.round(cx), Math.round(cy), 0]);
            }
        }

        var emoLabel = (entry.emoticons && entry.emoticons.length > 0) ? (" " + entry.emoticons[0]) : "";
        shapeLayer.name = "Emoji " + entry.emoji + " " + entry.name + " [" + entry.unicode + " | " + entry.unicodeInt + "]" + emoLabel;
        shapeLayer.label = 9;

        // Add/Update Effect Slider Controls on the layer
        var fxGroup = shapeLayer.property("ADBE Effect Parade") || shapeLayer.effects;
        if (fxGroup) {
            ensureEffectSlider(fxGroup, "Emoji Index", entry.index);
            ensureEffectSlider(fxGroup, "Emoji Unicode Int", entry.unicodeInt);
            ensureEffectSlider(fxGroup, "Emoji Source (1=OM,2=TW,3=Flat,4=Blk)", sourceObj.index);
            ensureEffectSlider(fxGroup, "Emoji Size (px)", sizePx);
            ensureEffectSlider(fxGroup, "Outline Width %", outlinePct);
            ensureEffectCheckbox(fxGroup, "Show Outlines", showOutlines);
        }

        populateEmojiVectorShapes(shapeLayer, entry, sourceObj.id, sizePx, outlinePct, showOutlines);

        // Select the created/updated layer so "Replace Emoji" is immediately active
        try {
            if (comp.layers && comp.layers._layers) {
                for (var li = 0; li < comp.layers._layers.length; li++) {
                    comp.layers._layers[li].selected = (comp.layers._layers[li] === shapeLayer);
                }
            }
            shapeLayer.selected = true;
        } catch (eSel) {}

        if (comp._onChanged) {
            try { comp._onChanged(); } catch (eChg) {}
        }

        return shapeLayer;
    }

    // Expose live-sync hook for AE_JS_builder timeline scrubbing
    if (typeof window !== "undefined") {
        window.__syncEmojiLayerFromEffect = function (layer, effectName) {
            if (!layer || !isEmojiLayer(layer)) return;
            try {
                var fx = layer.property("ADBE Effect Parade") || layer.effects;
                if (!fx) return;
                var idxVal = Math.round(fx.property("Emoji Index").property("Slider").value || 1);
                var intVal = Math.round(fx.property("Emoji Unicode Int").property("Slider").value || 128515);
                var srcIdx = Math.max(1, Math.min(4, Math.round(fx.property("Emoji Source (1=OM,2=TW,3=Flat,4=Blk)").property("Slider").value || 1)));
                var szVal = Math.max(16, fx.property("Emoji Size (px)").property("Slider").value || 280);
                var outPct = Math.max(0, fx.property("Outline Width %").property("Slider").value || 100);
                var showOut = Boolean(fx.property("Show Outlines").property("Checkbox").value);

                var srcObj = EMOJI_SOURCES[srcIdx - 1] || EMOJI_SOURCES[0];
                var targetEntry = null;

                if (effectName === "Emoji Index") {
                    idxVal = Math.max(1, Math.min(emojiCatalog.length, idxVal));
                    targetEntry = emojiByIndex[idxVal] || emojiCatalog[0];
                    fx.property("Emoji Unicode Int").property("Slider").setValue(targetEntry.unicodeInt);
                } else if (effectName === "Emoji Unicode Int") {
                    targetEntry = findNearestEmojiByUnicodeInt(intVal);
                    fx.property("Emoji Index").property("Slider").setValue(targetEntry.index);
                } else {
                    targetEntry = emojiByIndex[idxVal] || findNearestEmojiByUnicodeInt(intVal) || emojiCatalog[0];
                }

                if (targetEntry) {
                    var emoLabel = (targetEntry.emoticons && targetEntry.emoticons.length > 0) ? (" " + targetEntry.emoticons[0]) : "";
                    layer.name = "Emoji " + targetEntry.emoji + " " + targetEntry.name + " [" + targetEntry.unicode + " | " + targetEntry.unicodeInt + "]" + emoLabel;
                    populateEmojiVectorShapes(layer, targetEntry, srcObj.id, szVal, outPct, showOut);
                }
            } catch (eSync) {}
        };
    }

    // =========================================================================
    // 7. SCRIPTUI INTERFACE CONSTRUCTION
    // =========================================================================
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_TITLE, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        var currentMatches = emojiCatalog.slice();
        // Default initial selection: 😃 U+1F603 (:D)
        var currentEntry = emojiByHex["1F603"] || emojiCatalog[0];
        var currentSourceObj = EMOJI_SOURCES[0];
        var isSyncingUI = false;

        // ---------------------------------------------------------------------
        // PANEL 1: SOURCE (.JSON IN /emojis/) & CATEGORY FILTER
        // ---------------------------------------------------------------------
        var pnlSource = win.add("panel", undefined, "1. Emoji Vector Source & Category (/emojis/*.json)");
        pnlSource.orientation = "column";
        pnlSource.alignChildren = ["fill", "top"];
        pnlSource.spacing = 5;
        pnlSource.margins = [10, 14, 10, 8];

        var grpSrcRow = pnlSource.add("group");
        grpSrcRow.orientation = "row";
        grpSrcRow.alignChildren = ["left", "center"];
        grpSrcRow.spacing = 6;

        var lblSrc = grpSrcRow.add("statictext", undefined, "Source:");
        lblSrc.preferredSize.width = 58;

        var srcNames = [];
        for (var si = 0; si < EMOJI_SOURCES.length; si++) {
            srcNames.push(EMOJI_SOURCES[si].label);
        }
        var ddSource = grpSrcRow.add("dropdownlist", undefined, srcNames);
        ddSource.selection = 0;
        ddSource.alignment = ["fill", "center"];
        ddSource.helpTip = "Choose the vector emoji style from the /emojis/ JSON database.";

        var btnReloadJSON = grpSrcRow.add("button", undefined, "↻");
        btnReloadJSON.preferredSize = [28, 24];
        btnReloadJSON.helpTip = "Reload .JSON emoji files from the /emojis/ subfolder.";

        var btnChooseFolder = grpSrcRow.add("button", undefined, "📂");
        btnChooseFolder.preferredSize = [28, 24];
        btnChooseFolder.helpTip = "Select a custom /emojis/ JSON folder on disk.";

        var grpCatRow = pnlSource.add("group");
        grpCatRow.orientation = "row";
        grpCatRow.alignChildren = ["left", "center"];
        grpCatRow.spacing = 6;

        var lblCat = grpCatRow.add("statictext", undefined, "Category:");
        lblCat.preferredSize.width = 58;

        var catNames = [];
        for (var ci = 0; ci < CATEGORY_FILTERS.length; ci++) {
            catNames.push(CATEGORY_FILTERS[ci].label);
        }
        var ddCategory = grpCatRow.add("dropdownlist", undefined, catNames);
        ddCategory.selection = 0;
        ddCategory.alignment = ["fill", "center"];

        // ---------------------------------------------------------------------
        // PANEL 2: SEARCH BY NAME, UNICODE, INTEGER, EMOJI OR WIKIPEDIA EMOTICON
        // ---------------------------------------------------------------------
        var pnlSearch = win.add("panel", undefined, "2. Find Emoji (Name, Unicode, Integer, Glyph, or Emoticon)");
        pnlSearch.orientation = "column";
        pnlSearch.alignChildren = ["fill", "top"];
        pnlSearch.spacing = 5;
        pnlSearch.margins = [10, 14, 10, 8];

        var grpQueryRow = pnlSearch.add("group");
        grpQueryRow.orientation = "row";
        grpQueryRow.alignChildren = ["left", "center"];
        grpQueryRow.spacing = 6;

        var lblQuery = grpQueryRow.add("statictext", undefined, "Search:");
        lblQuery.preferredSize.width = 58;

        var etSearch = grpQueryRow.add("edittext", undefined, ":D");
        etSearch.alignment = ["fill", "center"];
        etSearch.preferredSize.width = 150;
        etSearch.helpTip = "Type emoji name ('grinning', 'fire'), Unicode ('1F603', 'U+1F603'), integer ('128515'), glyph ('😃'), or Wikipedia emoticon (':D', ':)', '<3', 'XD', '¯\\_(ツ)_/¯').";

        var btnFind = grpQueryRow.add("button", undefined, "Find");
        btnFind.preferredSize = [48, 24];

        var btnClearSearch = grpQueryRow.add("button", undefined, "All");
        btnClearSearch.preferredSize = [38, 24];
        btnClearSearch.helpTip = "Clear search box and list all emojis in the current category.";

        // Wikipedia Emoticon Quick-Pick Pulldown (from https://en.wikipedia.org/wiki/List_of_emoticons)
        var grpWikiRow = pnlSearch.add("group");
        grpWikiRow.orientation = "row";
        grpWikiRow.alignChildren = ["left", "center"];
        grpWikiRow.spacing = 6;

        var lblWiki = grpWikiRow.add("statictext", undefined, "Emoticon:");
        lblWiki.preferredSize.width = 58;

        var wikiItems = ["-- Wikipedia Emoticon Shortcuts (e.g. :D, :), <3) --"];
        for (var wi = 0; wi < wikiEntries.length; wi++) {
            var weItem = wikiEntries[wi];
            var sampleEmos = (weItem.emoticons || []).slice(0, 4).join("  ");
            wikiItems.push(sampleEmos + "   \u2192   " + weItem.emoji + "  " + weItem.meaning + " (" + weItem.unicode + " = " + weItem.unicodeInt + ")");
        }
        var ddWikiEmoticon = grpWikiRow.add("dropdownlist", undefined, wikiItems);
        ddWikiEmoticon.selection = 0;
        ddWikiEmoticon.alignment = ["fill", "center"];
        ddWikiEmoticon.helpTip = "Select a Western or Eastern text emoticon from Wikipedia's List of Emoticons.";

        // Matching Emoji Results Pulldown
        var grpResRow = pnlSearch.add("group");
        grpResRow.orientation = "row";
        grpResRow.alignChildren = ["left", "center"];
        grpResRow.spacing = 6;

        var lblRes = grpResRow.add("statictext", undefined, "Located:");
        lblRes.preferredSize.width = 58;

        var ddResults = grpResRow.add("dropdownlist", undefined, []);
        ddResults.alignment = ["fill", "center"];
        ddResults.helpTip = "Matching emojis from /emojis/emoji_index.json.";

        // ---------------------------------------------------------------------
        // PANEL 3: SLIDER INDEXING & UNICODE <-> INTEGER CONVERSION
        // ---------------------------------------------------------------------
        var pnlConv = win.add("panel", undefined, "3. Slider Index & Unicode \u2194 Integer Conversion");
        pnlConv.orientation = "column";
        pnlConv.alignChildren = ["fill", "top"];
        pnlConv.spacing = 5;
        pnlConv.margins = [10, 14, 10, 8];

        // Big Preview + Conversion Banner
        var stBanner = pnlConv.add("statictext", undefined, "😃  grinning face with big eyes   |   U+1F603  \u21C4  128515");
        try {
            stBanner.graphics.font = ScriptUI.newFont("Arial", "BOLD", 12);
        } catch (eFont) {}

        var stEmoticonsLine = pnlConv.add("statictext", undefined, "Wikipedia Emoticons: :-D, :D, 8-D, 8D, =D, =3, B^D, c:, C:");

        // Catalog Index Slider (1 .. N)
        var grpIdxSlider = pnlConv.add("group");
        grpIdxSlider.orientation = "row";
        grpIdxSlider.alignChildren = ["left", "center"];
        grpIdxSlider.spacing = 6;

        var lblIdxSlider = grpIdxSlider.add("statictext", undefined, "Emoji Index:");
        lblIdxSlider.preferredSize.width = 82;

        var slIndex = grpIdxSlider.add("slider", undefined, currentEntry.index, 1, Math.max(2, emojiCatalog.length));
        slIndex.alignment = ["fill", "center"];
        slIndex.preferredSize.width = 140;
        slIndex.helpTip = "Scrub through all indexed emojis in /emojis/emoji_index.json.";

        var etIndex = grpIdxSlider.add("edittext", undefined, String(currentEntry.index));
        etIndex.preferredSize.width = 48;

        // Unicode Integer Slider (converts integer <-> Unicode hex live)
        var grpIntSlider = pnlConv.add("group");
        grpIntSlider.orientation = "row";
        grpIntSlider.alignChildren = ["left", "center"];
        grpIntSlider.spacing = 6;

        var lblIntSlider = grpIntSlider.add("statictext", undefined, "Unicode Int:");
        lblIntSlider.preferredSize.width = 82;

        var slUnicodeInt = grpIntSlider.add("slider", undefined, currentEntry.unicodeInt, 9728, 129782);
        slUnicodeInt.alignment = ["fill", "center"];
        slUnicodeInt.preferredSize.width = 140;
        slUnicodeInt.helpTip = "Reference emojis by their converted 32-bit Unicode integer codepoint.";

        var etUnicodeInt = grpIntSlider.add("edittext", undefined, String(currentEntry.unicodeInt));
        etUnicodeInt.preferredSize.width = 62;
        etUnicodeInt.helpTip = "Decimal Integer conversion of Unicode Hex (parseInt(hex, 16)). Edit to convert Integer -> Unicode.";

        // Explicit Hex <-> Integer Conversion Row
        var grpHexConv = pnlConv.add("group");
        grpHexConv.orientation = "row";
        grpHexConv.alignChildren = ["left", "center"];
        grpHexConv.spacing = 6;

        var lblHex = grpHexConv.add("statictext", undefined, "Unicode Hex:");
        lblHex.preferredSize.width = 82;

        var etUnicodeHex = grpHexConv.add("edittext", undefined, currentEntry.unicode);
        etUnicodeHex.preferredSize.width = 82;
        etUnicodeHex.helpTip = "Unicode Hexadecimal codepoint (e.g. U+1F603). Edit to convert Unicode -> Integer.";

        var stArrow = grpHexConv.add("statictext", undefined, "\u21C4  Int =");

        var stFormula = grpHexConv.add("statictext", undefined, "128515  (0x1F603)");
        stFormula.alignment = ["fill", "center"];

        // ---------------------------------------------------------------------
        // PANEL 4: LAYER SIZE, OUTLINES & LIVE RIG CONTROLS
        // ---------------------------------------------------------------------
        var pnlStyle = win.add("panel", undefined, "4. Shape Layer Size & Outline Controls");
        pnlStyle.orientation = "column";
        pnlStyle.alignChildren = ["fill", "top"];
        pnlStyle.spacing = 5;
        pnlStyle.margins = [10, 14, 10, 8];

        var grpSize = pnlStyle.add("group");
        grpSize.orientation = "row";
        grpSize.alignChildren = ["left", "center"];
        grpSize.spacing = 6;

        var lblSize = grpSize.add("statictext", undefined, "Emoji Size:");
        lblSize.preferredSize.width = 82;

        var slSize = grpSize.add("slider", undefined, 280, 32, 800);
        slSize.alignment = ["fill", "center"];
        slSize.preferredSize.width = 140;

        var etSize = grpSize.add("edittext", undefined, "280");
        etSize.preferredSize.width = 48;

        var grpOutline = pnlStyle.add("group");
        grpOutline.orientation = "row";
        grpOutline.alignChildren = ["left", "center"];
        grpOutline.spacing = 6;

        var lblOutline = grpOutline.add("statictext", undefined, "Outline %:");
        lblOutline.preferredSize.width = 82;

        var slOutline = grpOutline.add("slider", undefined, 100, 0, 300);
        slOutline.alignment = ["fill", "center"];
        slOutline.preferredSize.width = 140;

        var etOutline = grpOutline.add("edittext", undefined, "100");
        etOutline.preferredSize.width = 48;

        var grpChecks = pnlStyle.add("group");
        grpChecks.orientation = "row";
        grpChecks.alignChildren = ["left", "center"];
        grpChecks.spacing = 12;

        var chkOutlines = grpChecks.add("checkbox", undefined, "Show Outlines");
        chkOutlines.value = true;

        var chkLiveScrub = grpChecks.add("checkbox", undefined, "Live-Update Active Emoji on Slider Scrub");
        chkLiveScrub.value = true;

        // ---------------------------------------------------------------------
        // ACTION BUTTONS: SMART "ADD EMOJI" / "REPLACE EMOJI"
        // ---------------------------------------------------------------------
        var pnlActions = win.add("panel", undefined, "5. Place in Composition");
        pnlActions.orientation = "column";
        pnlActions.alignChildren = ["fill", "top"];
        pnlActions.spacing = 5;
        pnlActions.margins = [10, 12, 10, 8];

        var grpSelToggle = pnlActions.add("group");
        grpSelToggle.orientation = "row";
        grpSelToggle.alignChildren = ["left", "center"];
        grpSelToggle.spacing = 8;

        var chkSelectEmojiLayer = grpSelToggle.add("checkbox", undefined, "Emoji Layer Selected (Replace Mode)");
        chkSelectEmojiLayer.value = false;
        chkSelectEmojiLayer.helpTip = "Automatically turns ON when an Emoji layer is selected in the timeline. Uncheck to place in a new layer.";

        var stLayerTarget = pnlActions.add("statictext", undefined, "Target: New Shape Layer (Click 'Add Emoji' below)");

        var grpSubBtns = pnlActions.add("group");
        grpSubBtns.orientation = "row";
        grpSubBtns.alignChildren = ["fill", "center"];
        grpSubBtns.spacing = 6;

        var btnForceAddNew = grpSubBtns.add("button", undefined, "\u2795 Add New Layer");
        btnForceAddNew.helpTip = "Always create a new Emoji Shape Layer in the composition.";

        var btnForceReplace = grpSubBtns.add("button", undefined, "\uD83D\uDD04 Replace Active");
        btnForceReplace.helpTip = "Replace the selected (or most recent) Emoji Shape Layer in the composition.";

        var grpMainBtns = pnlActions.add("group");
        grpMainBtns.orientation = "row";
        grpMainBtns.alignChildren = ["fill", "center"];
        grpMainBtns.spacing = 6;

        var btnAddOrReplace = grpMainBtns.add("button", undefined, "\u2795 Add Emoji");
        btnAddOrReplace.preferredSize.height = 34;
        btnAddOrReplace.helpTip = "Places the located emoji in a new Shape Layer, or replaces the emoji if an Emoji layer is selected.";

        // =====================================================================
        // UI HELPER FUNCTIONS & EVENT HANDLERS
        // =====================================================================
        function updateButtonStateFromSelection() {
            var comp = (app && app.project) ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                btnAddOrReplace.text = "\u2795 Add Emoji";
                chkSelectEmojiLayer.value = false;
                stLayerTarget.text = "Target: New Shape Layer (Will create comp if needed)";
                return;
            }
            var canDetectSelection = (typeof comp.selectedLayers !== "undefined");
            if (!canDetectSelection) {
                btnAddOrReplace.text = "\u2795 Add / Replace Emoji";
                stLayerTarget.text = "Target: Add or Replace Emoji Layer";
                return;
            }
            var selEmojiLayer = getSelectedEmojiLayer(comp);
            if (selEmojiLayer) {
                btnAddOrReplace.text = "\uD83D\uDD04 Replace Emoji";
                chkSelectEmojiLayer.value = true;
                stLayerTarget.text = "Selected: \"" + selEmojiLayer.name.substring(0, 36) + "\"";
            } else {
                btnAddOrReplace.text = "\u2795 Add Emoji";
                chkSelectEmojiLayer.value = false;
                stLayerTarget.text = "No Emoji Layer Selected \u2192 Places in New Layer";
            }
        }

        function refreshConversionReadout(entry) {
            if (!entry) return;
            isSyncingUI = true;
            try {
                var hc = entry.hexcode;
                var uInt = entry.unicodeInt;
                stBanner.text = entry.emoji + "  " + entry.name + "   |   " + entry.unicode + "  \u21C4  " + uInt;
                if (entry.emoticons && entry.emoticons.length > 0) {
                    stEmoticonsLine.text = "Wikipedia Emoticons: " + entry.emoticons.join("  ");
                } else {
                    stEmoticonsLine.text = "Tags: " + ((entry.tags && entry.tags.length > 0) ? entry.tags.slice(0, 6).join(", ") : entry.group);
                }

                slIndex.maxvalue = Math.max(2, emojiCatalog.length);
                slIndex.value = entry.index;
                etIndex.text = String(entry.index);

                slUnicodeInt.value = Math.max(slUnicodeInt.minvalue, Math.min(slUnicodeInt.maxvalue, uInt));
                etUnicodeInt.text = String(uInt);

                etUnicodeHex.text = entry.unicode;
                stFormula.text = uInt + "  (0x" + hc + " | #" + entry.index + "/" + emojiCatalog.length + ")";
            } finally {
                isSyncingUI = false;
            }
            updateButtonStateFromSelection();
        }

        function populateResultsDropdown(matches, selectEntry) {
            isSyncingUI = true;
            try {
                ddResults.removeAll();
                currentMatches = matches || [];
                if (currentMatches.length === 0) {
                    ddResults.add("item", "(No matching emojis found)");
                    ddResults.selection = 0;
                    return;
                }
                var targetIdx = 0;
                for (var i = 0; i < currentMatches.length; i++) {
                    var m = currentMatches[i];
                    var emoHint = (m.emoticons && m.emoticons.length > 0) ? ("  (" + m.emoticons.slice(0, 2).join(", ") + ")") : "";
                    var label = "#" + m.index + "  " + m.emoji + "  " + m.name + "  [" + m.unicode + " = " + m.unicodeInt + "]" + emoHint;
                    ddResults.add("item", label);
                    if (selectEntry && m.hexcode === selectEntry.hexcode) {
                        targetIdx = i;
                    }
                }
                ddResults.selection = targetIdx;
                currentEntry = currentMatches[targetIdx];
            } finally {
                isSyncingUI = false;
            }
            if (currentEntry) {
                refreshConversionReadout(currentEntry);
            }
        }

        function runSearch(preserveEntry) {
            var catIdx = ddCategory.selection ? ddCategory.selection.index : 0;
            var catId = CATEGORY_FILTERS[catIdx] ? CATEGORY_FILTERS[catIdx].id : "all";
            var q = trimStr(etSearch.text);
            var matches = searchEmojis(q, catId);
            populateResultsDropdown(matches, preserveEntry ? currentEntry : (matches[0] || currentEntry));
        }

        function executePlaceEmoji(mode) {
            if (!currentEntry) {
                alert("Please locate or select an emoji first.");
                return;
            }

            var comp = (app && app.project) ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("Emoji_Comp", 1920, 1080, 1.0, 10, 30);
                comp.openInViewer();
            }

            var sizePx = Math.max(16, parseFloat(etSize.text) || 280);
            var outlinePct = Math.max(0, parseFloat(etOutline.text) || 100);
            var showOutlines = Boolean(chkOutlines.value);

            var targetLayer = null;
            var isReplacing = false;

            if (mode === "replace") {
                targetLayer = getAnyExistingEmojiLayer(comp);
                isReplacing = Boolean(targetLayer);
            } else if (mode === "auto") {
                targetLayer = getSelectedEmojiLayer(comp);
                isReplacing = Boolean(targetLayer);
            } else {
                // mode === "add": explicitly create a new layer
                targetLayer = null;
                isReplacing = false;
            }

            app.beginUndoGroup(isReplacing ? ("Replace Emoji -> " + currentEntry.emoji) : ("Add Emoji " + currentEntry.emoji));
            try {
                applyEmojiToLayer(comp, targetLayer, currentEntry, currentSourceObj, sizePx, outlinePct, showOutlines, isReplacing);
            } finally {
                app.endUndoGroup();
            }

            updateButtonStateFromSelection();
        }

        function maybeLiveUpdateActiveEmoji() {
            if (!chkLiveScrub.value || !currentEntry) return;
            var comp = (app && app.project) ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;
            var targetLayer = getAnyExistingEmojiLayer(comp);
            if (!targetLayer) return;

            var sizePx = Math.max(16, parseFloat(etSize.text) || 280);
            var outlinePct = Math.max(0, parseFloat(etOutline.text) || 100);
            var showOutlines = Boolean(chkOutlines.value);
            applyEmojiToLayer(comp, targetLayer, currentEntry, currentSourceObj, sizePx, outlinePct, showOutlines, true);
            updateButtonStateFromSelection();
        }

        // ---------------------------------------------------------------------
        // WIRE UP UI EVENTS
        // ---------------------------------------------------------------------
        ddSource.onChange = function () {
            var idx = ddSource.selection ? ddSource.selection.index : 0;
            currentSourceObj = EMOJI_SOURCES[idx] || EMOJI_SOURCES[0];
            maybeLiveUpdateActiveEmoji();
        };

        btnReloadJSON.onClick = function () {
            loadAllEmojiDatabases();
            runSearch(true);
            maybeLiveUpdateActiveEmoji();
        };

        btnChooseFolder.onClick = function () {
            if (typeof Folder === "undefined" || !Folder.selectDialog) {
                alert("In the web preview, /emojis/*.json files are loaded automatically from jsx/emojis/.");
                return;
            }
            var picked = Folder.selectDialog("Select the 'emojis' folder containing emoji_index.json and openmoji_color.json");
            if (picked && picked.exists) {
                customEmojisFolderPath = picked.fsName;
                loadAllEmojiDatabases();
                runSearch(false);
            }
        };

        ddCategory.onChange = function () {
            runSearch(false);
        };

        etSearch.onChanging = function () {
            runSearch(false);
        };
        etSearch.onChange = function () {
            runSearch(false);
        };
        btnFind.onClick = function () {
            runSearch(false);
        };
        btnClearSearch.onClick = function () {
            etSearch.text = "";
            ddWikiEmoticon.selection = 0;
            runSearch(false);
        };

        ddWikiEmoticon.onChange = function () {
            if (isSyncingUI) return;
            var selIdx = ddWikiEmoticon.selection ? ddWikiEmoticon.selection.index : 0;
            if (selIdx <= 0) return;
            var we = wikiEntries[selIdx - 1];
            if (we && we.emoticons && we.emoticons.length > 0) {
                etSearch.text = we.emoticons[0];
                runSearch(false);
                maybeLiveUpdateActiveEmoji();
            }
        };

        ddResults.onChange = function () {
            if (isSyncingUI) return;
            var selIdx = ddResults.selection ? ddResults.selection.index : 0;
            if (currentMatches[selIdx]) {
                currentEntry = currentMatches[selIdx];
                refreshConversionReadout(currentEntry);
                maybeLiveUpdateActiveEmoji();
            }
        };

        // Catalog Index Slider & EditBox
        slIndex.onChanging = function () {
            if (isSyncingUI) return;
            var idx = Math.max(1, Math.min(emojiCatalog.length, Math.round(this.value)));
            var entry = emojiByIndex[idx];
            if (entry) {
                currentEntry = entry;
                refreshConversionReadout(entry);
            }
        };
        slIndex.onChange = function () {
            if (isSyncingUI) return;
            var idx = Math.max(1, Math.min(emojiCatalog.length, Math.round(this.value)));
            var entry = emojiByIndex[idx];
            if (entry) {
                currentEntry = entry;
                refreshConversionReadout(entry);
                maybeLiveUpdateActiveEmoji();
            }
        };
        etIndex.onChange = function () {
            if (isSyncingUI) return;
            var idx = parseInt(this.text, 10);
            if (isNaN(idx)) idx = currentEntry ? currentEntry.index : 1;
            idx = Math.max(1, Math.min(emojiCatalog.length, idx));
            var entry = emojiByIndex[idx];
            if (entry) {
                currentEntry = entry;
                refreshConversionReadout(entry);
                maybeLiveUpdateActiveEmoji();
            }
        };

        // Unicode Integer Slider & EditBox (Integer <-> Unicode Hex conversion)
        slUnicodeInt.onChanging = function () {
            if (isSyncingUI) return;
            var targetInt = Math.round(this.value);
            var nearest = findNearestEmojiByUnicodeInt(targetInt);
            if (nearest) {
                currentEntry = nearest;
                refreshConversionReadout(nearest);
            }
        };
        slUnicodeInt.onChange = function () {
            if (isSyncingUI) return;
            var targetInt = Math.round(this.value);
            var nearest = findNearestEmojiByUnicodeInt(targetInt);
            if (nearest) {
                currentEntry = nearest;
                refreshConversionReadout(nearest);
                maybeLiveUpdateActiveEmoji();
            }
        };
        etUnicodeInt.onChange = function () {
            if (isSyncingUI) return;
            var rawInt = parseInt(trimStr(this.text), 10);
            if (isNaN(rawInt) || rawInt <= 0) {
                if (currentEntry) refreshConversionReadout(currentEntry);
                return;
            }
            var hexConverted = unicodeIntToHex(rawInt);
            if (emojiByInt[rawInt]) {
                currentEntry = emojiByInt[rawInt];
                refreshConversionReadout(currentEntry);
                maybeLiveUpdateActiveEmoji();
            } else {
                var nearest = findNearestEmojiByUnicodeInt(rawInt);
                if (nearest) {
                    currentEntry = nearest;
                    refreshConversionReadout(nearest);
                }
                etUnicodeInt.text = String(rawInt);
                etUnicodeHex.text = "U+" + hexConverted;
                stFormula.text = rawInt + "  (0x" + hexConverted + " -> nearest: " + (nearest ? nearest.emoji : "") + ")";
            }
        };

        // Unicode Hex EditBox (Hex <-> Integer conversion)
        etUnicodeHex.onChange = function () {
            if (isSyncingUI) return;
            var rawHex = trimStr(this.text).toUpperCase().replace(/^U\+/i, "").replace(/^0X/i, "");
            var convertedInt = unicodeHexToInt(rawHex);
            if (convertedInt <= 0) {
                if (currentEntry) refreshConversionReadout(currentEntry);
                return;
            }
            if (emojiByHex[rawHex]) {
                currentEntry = emojiByHex[rawHex];
                refreshConversionReadout(currentEntry);
                maybeLiveUpdateActiveEmoji();
            } else if (emojiByInt[convertedInt]) {
                currentEntry = emojiByInt[convertedInt];
                refreshConversionReadout(currentEntry);
                maybeLiveUpdateActiveEmoji();
            } else {
                etUnicodeHex.text = "U+" + rawHex;
                etUnicodeInt.text = String(convertedInt);
                stFormula.text = convertedInt + "  (0x" + rawHex + ")";
            }
        };

        // Size & Outline Sliders
        slSize.onChanging = function () {
            etSize.text = String(Math.round(this.value));
        };
        slSize.onChange = function () {
            etSize.text = String(Math.round(this.value));
            maybeLiveUpdateActiveEmoji();
        };
        etSize.onChange = function () {
            var v = Math.max(16, Math.min(2000, parseFloat(this.text) || 280));
            slSize.value = Math.min(800, v);
            this.text = String(Math.round(v));
            maybeLiveUpdateActiveEmoji();
        };

        slOutline.onChanging = function () {
            etOutline.text = String(Math.round(this.value));
        };
        slOutline.onChange = function () {
            etOutline.text = String(Math.round(this.value));
            maybeLiveUpdateActiveEmoji();
        };
        etOutline.onChange = function () {
            var v = Math.max(0, Math.min(500, parseFloat(this.text) || 100));
            slOutline.value = Math.min(300, v);
            this.text = String(Math.round(v));
            maybeLiveUpdateActiveEmoji();
        };

        chkOutlines.onClick = function () {
            maybeLiveUpdateActiveEmoji();
        };

        chkSelectEmojiLayer.onClick = function () {
            var comp = (app && app.project) ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;
            if (this.value) {
                var lyr = getAnyExistingEmojiLayer(comp);
                if (lyr) {
                    try { lyr.selected = true; } catch (e) {}
                } else {
                    this.value = false;
                }
            } else {
                try {
                    if (comp.layers && comp.layers._layers) {
                        for (var i = 0; i < comp.layers._layers.length; i++) {
                            comp.layers._layers[i].selected = false;
                        }
                    }
                    var sel = comp.selectedLayers;
                    if (sel) {
                        for (var j = 0; j < sel.length; j++) {
                            try { sel[j].selected = false; } catch (e2) {}
                        }
                    }
                } catch (e3) {}
            }
            updateButtonStateFromSelection();
        };

        // Action Buttons
        btnAddOrReplace.onClick = function () {
            executePlaceEmoji("auto");
        };
        btnForceAddNew.onClick = function () {
            executePlaceEmoji("add");
        };
        btnForceReplace.onClick = function () {
            executePlaceEmoji("replace");
        };

        // Listen for timeline layer selection changes in AE_JS_builder
        if (typeof window !== "undefined" && window.addEventListener) {
            window.addEventListener("ae-layer-selection-changed", function () {
                updateButtonStateFromSelection();
            });
        }

        // Initial search for ":D" -> locates 😃 (U+1F603 = 128515)
        runSearch(false);

        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }

        return win;
    }

    buildUI(thisObj);

})(this);

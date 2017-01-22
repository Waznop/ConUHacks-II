/*/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// constants
var frequencyThreshhold = 10;
var frequencyMultiplier = 1.5;
var relevance100k = 10;
var relevance150k = 20;
var relevanceMax = 30;
var flowScoreMax = 30;
var endRhymeScoreMax = 40;

// line stats
var curLine = []; // word[]
var curLineIdx = 0;
var prevProns = []; // word[][]
var totalSyllables = 0;
var bestRhyme = 0;
var bestAlliteration = 0;

var lineWordCount = {}; // word : count
var curRelevance = 0;
var flowScore = 0;

function resetLineStats() {
  curLine = [];
  curLineIdx = 0;
  prevProns = [];
  totalSyllables = 0;
  bestRhyme = 0;
  bestAlliteration = 0;
  lineWordCount = {};
  curRelevance = 0;
  flowScore = 0;
}

// Initializes FriendlyChat.
function FriendlyChat() {
  this.checkSetup();

  // variables
  this.state = "none";
  this.topic = "none";
  this.line = 0;

  // poem
  this.totalRhyme = 0;
  // this.endWordCount = {}; // word : count
  this.endPronsDict = []; // word : count
  this.strictNumSyllables = 0;

  // Shortcuts to DOM Elements.
  this.messageList = document.getElementById('messages');
  this.messageForm = document.getElementById('message-form');
  this.messageInput = document.getElementById('message');
  this.submitButton = document.getElementById('submit');
  this.submitImageButton = document.getElementById('submitImage');
  this.imageForm = document.getElementById('image-form');
  this.mediaCapture = document.getElementById('mediaCapture');
  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  this.signInSnackbar = document.getElementById('must-signin-snackbar');

  // Saves message on form submit.
  this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));

  // Toggle for the button.
  var buttonTogglingHandler = this.toggleButton.bind(this);
  this.messageInput.addEventListener('keyup', buttonTogglingHandler);
  this.messageInput.addEventListener('change', buttonTogglingHandler);

  // Events for image upload.
  this.submitImageButton.addEventListener('click', function() {
    this.mediaCapture.click();
  }.bind(this));
  this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

  this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
FriendlyChat.prototype.initFirebase = function() {
  // Shortcuts to Firebase SDK features.
  this.auth = firebase.auth();
  this.database = firebase.database();
  this.storage = firebase.storage();
  // Initiates Firebase auth and listen to auth state changes.
  this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

// Loads chat messages history and listens for upcoming ones.
FriendlyChat.prototype.loadMessages = function() {
  // Reference to the /messages/ database path.
  this.messagesRef = this.database.ref('messages');
  // Make sure we remove all previous listeners.
  this.messagesRef.off();

  // Reference to server variables
  this.varsRef = this.database.ref('vars');
  this.varsRef.off();

  this.poemRef = this.database.ref('poem');
  this.poemRef.off();

  // this.endWordCountRef = this.database.ref('poem/endWordCount');
  // this.endWordCountRef.off();

  //this.endPronsDictRef = this.database.ref('poem/endPronsDict');
  //this.endPronsDictRef.off();
  
  var setPoem = function(val) {
    debugger;
    this.totalRhyme = val.totalRhyme;
    this.strictNumSyllables = val.strictNumSyllables;
    this.endPronsDict = val.endPronsDict;
  }.bind(this);

  var initPoem = function() {
    this.poemRef.set({
      "totalRhyme": 0,
      "strictNumSyllables": 0,
      "endPronsDict": []
    });
  }.bind(this);
  
  // Loads the last 12 messages and listen for new ones.
  var setMessage = function(data) {
    var val = data.val();
    this.displayMessage(data.key, val.name, val.text, val.photoUrl, val.imageUrl, val.score);
  }.bind(this);

  var setVariables = function(val) {
    this.state = val.state;
    this.topic = val.topic;
    this.line = val.line;
    console.log(this.state + ", " + this.topic + ", " + this.line);
  }.bind(this);

  var initVariables = function() {
    this.varsRef.set({
      "state": "none",
      "topic": "none",
      "line": 0
    });
  }.bind(this);

/*
  var setEndPronsDict = function(data) {
    var val = data.val();
    this.endPronsDict = {};
    Object.keys(val).forEach(key => {
      this.endPronsDict[key] = val[key];
    });
  }.bind(this);
  */

/*
  var setEndWordCount = function(data) {
    var val = data.val();
    this.endWordCount = {};
    Object.keys(val).forEach(key => {
      this.endWordCount[key] = val[key];
    });
  }.bind(this);
  */

  this.messagesRef.limitToLast(12).on('child_added', setMessage);
  this.messagesRef.limitToLast(12).on('child_changed', setMessage);

/*
  this.endPronsDictRef.on('child_added', setEndPronsDict);
  this.endPronsDictRef.on('child_removed', setEndPronsDict);
  this.endPronsDictRef.on('child_changed', setEndPronsDict);
  this.endWordCountRef.on('child_added', setEndWordCount);
  this.endWordCountRef.on('child_removed', setEndWordCount);
  this.endWordCountRef.on('child_changed', setEndWordCount);
  */

  this.varsRef.on('child_changed', function(data) {
    var val = data.val();
    if (val && val.state && val.topic) {
      setVariables(val);
    }
  });

  this.varsRef.on("value", function(data) {
    var val = data.val();
    if (val && val.state && val.topic) {
      setVariables(val);
    } else {
      initVariables();
    }
  }, function(e) {
    console.log(e);
  });

  this.poemRef.on('child_changed', function(data) {
    var val = data.val();
    if (val) {
      setPoem(val);
    }
  });

  this.poemRef.on("value", function(data) {
    var val = data.val();
    if (val) {
      setPoem(val);
    } else {
      initPoem();
    }
  }, function(e) {
    console.log(e);
  });

};

// Saves a new message on the Firebase DB.
FriendlyChat.prototype.saveMessage = function(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.

  var msg = this.messageInput.value;

  if (msg && this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    var newState;
    var newTopic;
    var tmpTopic;

    if (msg[0] === '/') {
      if (msg.slice(1, 6) === "haiku") {
        newState = "haiku";
        tmpTopic = msg.slice(7).match(/[a-z]+/i);
        if (tmpTopic && tmpTopic.length > 0) {
          newTopic = tmpTopic[0];
        }
      } else if (msg.slice(1, 7) === "strict") {
        newState = "strict";
        tmpTopic = msg.slice(8).match(/[a-z]+/i);
        if (tmpTopic && tmpTopic.length > 0) {
          newTopic = tmpTopic[0];
        }
      } else if (msg.slice(1, 10) === "freestyle") {
        newState = "freestyle";
        tmpTopic = msg.slice(11).match(/[a-z]+/i);
        if (tmpTopic && tmpTopic.length > 0) {
          newTopic = tmpTopic[0];
        }
      } else if (msg.slice(1, 4) === "end") {
        if (this.state !== "none") {
          newState = "none";
          newTopic = "none";
        }
      }
      sendUpdatedInfo.call(this, -1);
    } else if (this.state !== "none") {
      var promise = new Promise(function(resolve, reject) {
        parseString.call(this, msg, resolve);
      }.bind(this));
      promise.then(function(v) {
        console.log("relevance: " + curRelevance + ", flow: " + flowScore);
        var lineScore = parseInt((curRelevance + flowScore) * 5 / 3);
        sendUpdatedInfo.call(this, lineScore);
      }.bind(this));
    } else {
      sendUpdatedInfo.call(this, -1);
    }

    function sendUpdatedInfo(lineScore) {
      console.log(this.totalRhyme);
      this.messagesRef.push({
        name: currentUser.displayName,
        text: msg,
        score: lineScore,
        photoUrl: currentUser.photoURL || '/images/profile_placeholder.png'
      }).then(function() {
        if (newState && newTopic) {
          var text;
          switch(newState) {
            case "haiku":
              text = "Starting a new Haiku (5-7-5 syllables) challenge with " +
                newTopic + " as the topic!";
              break;
            case "strict":
              text = "Starting a new Strict mode challenge (every fire you spit must be of the same length) with " +
                newTopic + " as the topic!";
              break;
            case "freestyle":
              text = "Starting a new Freestyle rap challenge with " +
                newTopic + " as the topic!";
              break;
            default:
              text = "End of challenge!";

          }
          this.messagesRef.push({
            name: "Eminem",
            text: text,
            score: lineScore,
            photoUrl: '/images/profile_eminem.jpg'
          });
          this.varsRef.update({
            "state": newState,
            "topic": newTopic,
            "line": 0
          });
        } else if (this.state !== "none") {
          this.poemRef.update({
            "totalRhyme": this.totalRhyme,
            "strictNumSyllables": this.strictNumSyllables,
            "endPronsDict": this.endPronsDict
          });
          /*
          debugger;
          this.endWordCountRef.remove();
          Object.keys(this.endWordCount).forEach(key => {
            this.endWordCountRef.update({
              key: this.endWordCount[key]
            });
          });
          this.endPronsDictRef.remove();
          Object.keys(this.endPronsDict).forEach(key => {
            this.endPronsDictRef.update({
              key: this.endWordCount[key]
            });
          });
          */

          var lineRef = this.varsRef.child("line");
          lineRef.transaction(function(line) {
            this.line = line + 1;
            return line + 1;
          });
        }
      }.bind(this)).then(function() {
        // Clear message text field and SEND button state.
        FriendlyChat.resetMaterialTextfield(this.messageInput);
        this.toggleButton();
      }.bind(this)).catch(function(error) {
        console.error('Error writing new message to Firebase Database', error);
      });
    }
  }
};

// Sets the URL of the given img element with the URL of the image stored in Firebase Storage.
FriendlyChat.prototype.setImageUrl = function(imageUri, imgElement) {
  // If the image is a Firebase Storage URI we fetch the URL.
  if (imageUri.startsWith('gs://')) {
    imgElement.src = FriendlyChat.LOADING_IMAGE_URL; // Display a loading image first.
    this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
      imgElement.src = metadata.downloadURLs[0];
    });
  } else {
    imgElement.src = imageUri;
  }
};

// Saves a new message containing an image URI in Firebase.
FriendlyChat.prototype.saveImageMessage = function(event) {
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  this.imageForm.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (this.checkSignedInWithMessage()) {

// We add a message with a loading icon that will get updated with the shared image.
    var currentUser = this.auth.currentUser;
    this.messagesRef.push({
      name: currentUser.displayName,
      imageUrl: FriendlyChat.LOADING_IMAGE_URL,
      photoUrl: currentUser.photoURL || '/images/profile_placeholder.png'
    }).then(function(data) {

      // Upload the image to Firebase Storage.
      this.storage.ref(currentUser.uid + '/' + Date.now() + '/' + file.name)
          .put(file, {contentType: file.type})
          .then(function(snapshot) {
            // Get the file's Storage URI and update the chat message placeholder.
            var filePath = snapshot.metadata.fullPath;
            data.update({imageUrl: this.storage.ref(filePath).toString()});
          }.bind(this)).catch(function(error) {
        console.error('There was an error uploading a file to Firebase Storage:', error);
      });
    }.bind(this));
  }
};

// Signs-in Friendly Chat.
FriendlyChat.prototype.signIn = function() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  this.auth.signInWithPopup(provider);
};

// Signs-out of Friendly Chat.
FriendlyChat.prototype.signOut = function() {
  // Sign out of Firebase.
  this.auth.signOut();
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
FriendlyChat.prototype.onAuthStateChanged = function(user) {
  if (user) { // User is signed in!
    // Get profile pic and user's name from the Firebase user object.
    var profilePicUrl = user.photoURL; // Only change these two lines!
    var userName = user.displayName;   // Only change these two lines!

    // Set the user's profile pic and name.
    this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
    this.userName.textContent = userName;

    // Show user's profile and sign-out button.
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');

    // Hide sign-in button.
    this.signInButton.setAttribute('hidden', 'true');

    // We load currently existing chant messages.
    this.loadMessages();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');

    // Show sign-in button.
    this.signInButton.removeAttribute('hidden');
  }
};

// Returns true if user is signed-in. Otherwise false and displays a message.
FriendlyChat.prototype.checkSignedInWithMessage = function() {
  // Return true if the user is signed in Firebase
  if (this.auth.currentUser) {
    return true;
  }
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  return false;
};

// Resets the given MaterialTextField.
FriendlyChat.resetMaterialTextfield = function(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
};

// Template for messages.
FriendlyChat.MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

// A loading image URL.
FriendlyChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

// Displays a Message in the UI.
FriendlyChat.prototype.displayMessage = function(key, name, text, picUrl, imageUri, score) {
  var div = document.getElementById(key);
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = FriendlyChat.MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    this.messageList.appendChild(div);
  }
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }
  var suffix = score && score != -1 ? " - score: " + score : "";
  div.querySelector('.name').textContent = name + suffix;
  var messageElement = div.querySelector('.message');
  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUri) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }.bind(this));
    this.setImageUrl(imageUri, image);
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  // Show the card fading-in.
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.messageList.scrollTop = this.messageList.scrollHeight;
  this.messageInput.focus();
};

// Enables or disables the submit button depending on the values of the input
// fields.
FriendlyChat.prototype.toggleButton = function() {
  if (this.messageInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }
};

// Checks that the Firebase SDK has been correctly setup and configured.
FriendlyChat.prototype.checkSetup = function() {
  if (!window.firebase || !(firebase.app instanceof Function) || !window.config) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions.');
  } else if (config.storageBucket === '') {
    window.alert('Your Firebase Storage bucket has not been enabled. Sorry about that. This is ' +
        'actually a Firebase bug that occurs rarely. ' +
        'Please go and re-generate the Firebase initialisation snippet (step 4 of the codelab) ' +
        'and make sure the storageBucket attribute is not empty. ' +
        'You may also need to visit the Storage tab and paste the name of your bucket which is ' +
        'displayed there.');
  }
};

window.onload = function() {
  window.friendlyChat = new FriendlyChat();
};

// mutates flowScore
function updateFlowScore() {
  if (bestRhyme > 1) {
    flowScore += 20;
  }
  if (bestAlliteration > 1) {
    flowScore += 10;
  }
  for (var i = 0; i < bestRhyme - 1; ++i) {
    flowScore += 5;
  }
  for (var i = 0; i < bestAlliteration - 1; ++i) {
    flowScore += 5;
  }
  if (flowScore > flowScoreMax) {
    flowScore = flowScoreMax;
  }
}

// mutates lineWordCount and prevProns
function calculateWordScore(res) {
  if (lineWordCount[res.word]) {
    ++lineWordCount[res.word];
    return;
  }
  lineWordCount[res.word] = 1;
  lineRhyme(res.pron);
  alliteration(res.pron);
  updateFlowScore();
  calculateRelevance(res.relevance, res.freq);
  prevProns.push(res.pron);
}

// mutates endWordCount
function calculateLineScore(res) {
  /*
  if (!this.endWordCount) {
    this.endWordCount = {};
  }
  if (this.endWordCount[res.word]) {
    ++this.endWordCount[res.word];
    return;
  }
  this.endWordCount[res.word] = 1;
  */
  endRhyme.call(this, res.pron);
  checkStructure.call(this);
}

// mutates totalRhyme
function checkStructure() {
  switch(this.state) {
    case "haiku":
      if (this.line == 1 || this.line == 3) {
        if (totalSyllables != 5) {
          this.totalRhyme = 0;
        }
      } else if (this.line == 2) {
        if (totalSyllables != 7) {
          this.totalRhyme = 0;
        }
      } else {
        this.totalRhyme = 0;
      }
      break;
    case "strict":
      if (this.strictNumSyllables == 0) {
        this.strictNumSyllables = totalSyllables;
      } else if (this.strictNumSyllables != totalSyllables) {
        this.totalRhyme = 0;
      }
  }
}

// mutates endPronsDict and curTotalRhyme
function endRhyme(pron) {
  var lastRhyme = pron[pron.length-1];
  var endProns = {};
  var curTotalRhyme = 0;
  for (var i = 0; i < this.endPronsDict.length; ++i) {
    var endPron = this.endPronsDict[i];
    if (endProns[endPron]) {
      ++curTotalRhyme;
    } else {
      endProns[endPron] = true;
    }
  }
  if (endProns[lastRhyme]) {
    ++curTotalRhyme;
  }
  curTotalRhyme = curTotalRhyme * endRhymeScoreMax / this.line;
  if (curTotalRhyme > this.totalRhyme) {
    this.totalRhyme = curTotalRhyme;
  }
}

// mutates curRelevance
function calculateRelevance(relevance, freq) {
  var multiplier = freq < frequencyThreshhold ? frequencyMultiplier : 1;
  if (relevance > 150000 && curRelevance < relevanceMax) {
    curRelevance += relevance150k * multiplier;
  } else if (relevance > 100000 && curRelevance < relevanceMax) {
    curRelevance += relevance100k * multiplier;
  }
  if (curRelevance > relevanceMax) {
    curRelevance = relevanceMax;
  }
}

// mutates bestRhyme
function lineRhyme(pron) {
  var curRhyme = 0;
  for (var i = 0; i < prevProns.length; ++i) {
    var prevPron = prevProns[i];
    var prevPronIdx = prevPron.length-1;
    var curPronIdx = pron.length-1;
    while (prevPronIdx >= 0 && curPronIdx >= 0) {
      if (prevPron[prevPronIdx] == pron[curPronIdx]) {
        ++curRhyme;
      } else {
        break;
      }
      --prevPronIdx;
      --curPronIdx;
    }
  }
  if (curRhyme > bestRhyme) {
    bestRhyme = curRhyme;
  }
}

// mutates bestAlliteration
function alliteration(pron) {
  var curAlliteration = 0;
  for (var i = 0; i < prevProns.length; ++i) {
    var prevPron = prevProns[i];
    for (var j = 0; j < prevPron.length && j < pron.length; ++j) {
      if (prevPron[j] == pron[j]) {
        ++curAlliteration;
      } else {
        break;
      }
    }
  }
  if (curAlliteration > bestAlliteration) {
    bestAlliteration = curAlliteration;
  }
}

// sends the actual request
function analyze(word, resolve) {
  var link = "//api.datamuse.com/words?md=rfs&sp=" + word + "&topics=" + this.topic;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', link, true);
  xhr.send();
  xhr.addEventListener("readystatechange", processRequest, false);

  function processRequest(e) {
    var res = {};
    res.word = word;
    if (xhr.readyState != 4) {
      return;
    }
    if (xhr.status == 200) {
      var response = JSON.parse(xhr.responseText);
      for (var i = 0; i < response.length; ++i) {
        var curWord = response[i];
        if (curWord.word == word) {
          res.pron = curWord.tags[0].slice(5, -1).split(' ');
          res.freq = Number(curWord.tags[1].slice(2));
          res.relevance = curWord.score ? (curWord.score > 0 ? curWord.score : -curWord.score) : 0;
          totalSyllables += curWord.numSyllables;
          break;
        }
      }
    }
    if (!res.freq) {
      res.pron = [];
      res.freq = 0;
      res.relevance = 0;
      totalSyllables += numSyllables(word);
    }
    calculateWordScore(res);
    ++curLineIdx;
    if (curLineIdx < curLine.length) {
      analyze.call(this, curLine[curLineIdx], resolve);
    } else {
      calculateLineScore.call(this, res);
      resolve();
    }
  }
}

// string -> word[]
function parseString(str, resolve) {
  resetLineStats();
  var arr = str.match(/[a-z]+|[0-9]+/gi);
  if (!arr) return;
  for (var i = 0; i < arr.length; ++i) {
    var word = arr[i];
    if (!isNaN(parseInt(word))) { // if it's a number
      var numWord = numToWord(word);
      var numWordArr = numWord.match(/[a-z]+/gi);
      for (var j = 0; j < numWordArr.length; ++j) {
        curLine.push(numWordArr[j]);
      }
    } else {
      curLine.push(word);
    }
  }

  analyze.call(this, curLine[curLineIdx], resolve);
}

// word -> int
function numSyllables(word) {
  word = word.replace(/(?:[^laeiouy]es?|ed)$/i, '');
  word = word.replace(/^y/, '');
  var arr = word.match(/[aeiouy]{1,2}/g);
  return arr ? arr.length : 0;
}

// int -> string
function numToWord(num) {
  if (num == 0) return "zero";

  var a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ',
  'eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
  var b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];

  if ((num = num.toString()).length > 9) return ''; // overflow
  var n = ('000000000' + num).substr(-9).match(/^(\d{1})(\d{2})(\d{1})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  var str = '';
  str += (n[1] != 0) ? (a[Number(n[1])]) + 'hundred ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'million ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])]) + 'hundred ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'thousand ' : '';
  str += (n[5] != 0) ? (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'hundred ' : '';
  str += (n[6] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[6])] || b[n[6][0]] + ' ' + a[n[6][1]]) : '';
  return str;
}
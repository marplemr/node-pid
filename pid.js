var Controller = require('node-pid-controller');
var ads1x15 = require('node-ads1x15');
var gpio = require('rpi-gpio');

process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  console.log("closing all gpios");
    gpio.destroy(function () {
          process.exit();
    })
});
var adcSampleSize = 5
var chip = 1; //0 for ads1015, 1 for ads1115
var pidSettings = {
  k_p: 20,
  k_i: 0.01,
  k_d: 16,
  dt: 1
}
var ctrTop = new Controller(pidSettings)
var ctrBot = new Controller(pidSettings)
var sampleRate = 100
var setTarget = 180
var interval = 1000
var botPlateGPIO = 18
var topPlateGPIO = 22
var thermistorBotOn
var thermistorTopOn
//Simple usage (default ADS address on pi 2b or 3):
var adc = new ads1x15(chip);
var channel = 0; //channel 0, 1, 2, or 3...
var samplesPerSecond = '250'; // see index.js for allowed values for your chip
var progGainAmp = '512'; // see index.js for allowed values for your chip
var goalReachedBot = false
var goalReachedTop = false

ctrTop.setTarget(setTarget)
ctrBot.setTarget(setTarget)

function mvToC (mVCh1, mVCh2, ohmRef, offset) {
  // var thermistorOhms = 3300/(mV/1000) - 1000
  var thermistorOhms = ohmRef * (1 / ((mVCh1 / mVCh2) - 1)) - offset
  // var celsius = (thermistorOhms/604 - 1)/0.00518
  var celsius = (thermistorOhms / 100 - 1) / 0.00385
  var far = celsius * (9 / 5) + 32
  return {temp: far, res: thermistorOhms}
}

function shouldISwitch (plate, gpioNum, correction, thermistorOn) {
  var goalReached = plate === 'top' ? goalReachedTop : goalReachedBot

  if (goalReached) {
    console.log('perfectTemp!')
  }

  if (correction > 0) {
    if (!thermistorOn) {
      return gpio.setup(gpioNum, gpio.DIR_OUT, function () {
        gpio.write(gpioNum, false, function(err) {
          if (err) throw err;
          if (plate === 'top') {
            thermistorTopOn = true
          } else {
            thermistorBotOn = true
          }
          console.log('---- heater-' + plate + 'SWITCHED-ON! ----')
        })
      })
    }
  }

  if (correction < 0) {
    if (thermistorOn) {
      return gpio.setup(gpioNum, gpio.DIR_OUT, function () {
        gpio.write(gpioNum, true, function(err) {
          if (err) throw err;
          console.log('---- heater-' + plate + 'SWITCHED-OFF! ----')
          if (plate === 'top') {
            thermistorTopOn = false
          } else {
            thermistorBotOn = false
          }
        })
      })
    }
  }
}

// function perfectTemp (sampleSize) {
//   console.log('')
//   // console.log('heaterTop:', ' ', thermistorTopOn ? 'ON' : 'OFF')
//   // console.log('heaterBot:', ' ', thermistorBotOn ? 'ON' : 'OFF')
//   var count = 0
//   var data = {
//     ch1: [],
//     ch2: [],
//     ch3: [],
//     ch4: []
//   }
//   readAll(sampleSize)
//     .then(res => {
//       // done with averaging
//       var averages = Object.assign({}, data)
//       ch1Avg = averages.ch1.reduce((a,b) => a + b, 0) / averages.ch1.length
//       ch2Avg = averages.ch2.reduce((a,b) => a + b, 0) / averages.ch2.length
//       ch3Avg = averages.ch3.reduce((a,b) => a + b, 0) / averages.ch3.length
//       ch4Avg = averages.ch4.reduce((a,b) => a + b, 0) / averages.ch4.length
//
//       var tempBotPlate = mvToC(ch1Avg, ch2Avg, 221, 1.4).temp
//       var tempTopPlate = mvToC(ch3Avg, ch4Avg, 235, 19).temp
//       var correctionTop  = ctrTop.update(tempTopPlate)
//       var correctionBot  = ctrBot.update(tempBotPlate)
//       console.log('Setpoint: ', setTarget + ' F')
//       console.log('Temp Top Plate: ' + tempTopPlate + ' F')
//       console.log('Correction: ', correctionTop)
//       console.log('------------')
//       console.log('Temp Bottom Plate: ' + tempBotPlate + ' F')
//       console.log('Correction: ', correctionBot)
//       console.log('------------')
//       // applyInputToActuator(input);
//       data = {}
//
//       shouldISwitch('bottom', botPlateGPIO, correctionBot, thermistorBotOn)
//       shouldISwitch('top', topPlateGPIO, correctionTop, thermistorTopOn)
//       return setTimeout(function() {
//         perfectTemp(adcSampleSize)
//       }, interval)
//
//     })
//
//   function readAll (avgSample) {
//
//     function tako () {
//       adc.readADCSingleEnded(channel, progGainAmp, samplesPerSecond, function(err, dataCh1) {
//         if (err) {
//           //logging / troubleshooting code goes here...
//           throw err;
//         }
//         adc.readADCSingleEnded(1, progGainAmp, samplesPerSecond, function(err, dataCh2) {
//           if (err) {
//             //logging / troubleshooting code goes here...
//             throw err;
//           }
//           adc.readADCSingleEnded(2, progGainAmp, samplesPerSecond, function(err, dataCh3) {
//             if (err) {
//               //logging / troubleshooting code goes here...
//               throw err;
//             }
//             adc.readADCSingleEnded(3, progGainAmp, samplesPerSecond, function(err, dataCh4) {
//               if (err) {
//                 //logging / troubleshooting code goes here...
//                 throw err;
//               }
//               // if you made it here, then the data object contains your reading!
//               var mvCh1 = dataCh1
//               var mvCh2 = dataCh2
//               var mvCh3 = dataCh3
//               var mvCh4 = dataCh4
//
//               data.ch1.push(mvCh1)
//               data.ch2.push(mvCh2)
//               data.ch3.push(mvCh3)
//               data.ch4.push(mvCh4)
//             })
//           })
//         })
//       })
//     }
//
//     if (count - avgSample < 0) {
//       if (!adc.busy) {
//         count++
//         return readAll(avgSample)
//       }
//       function retry () {
//         return setTimeout(function () {
//           if (!adc.busy) {
//             count++
//             return readAll(avgSample)
//           }
//           return retry()
//         }, 5)
//       }
//       return retry()
//     }
//     count = 0
//     return Promise.resolve()
//   }
// // return averages
// }

// gpio.setup(botPlateGPIO, gpio.DIR_IN, function () {
//   gpio.read(botPlateGPIO, function(err, valueBot) {
//     if (err) throw err;
//     gpio.setup(topPlateGPIO, gpio.DIR_IN, function () {
//       gpio.read(topPlateGPIO, function(err, valueTop) {
//         if (err) throw err;
//         console.log('')
//         console.log('heater on/off ?');
//         console.log(valueBot ? 'Bottom-ON' : 'Bottom-OFF')
//         console.log(valueTop ? 'Top-ON' : 'Top-OFF')
//         perfectTemp(adcSampleSize)
//       })
//     })
//   })
// })







count = 0
var ChData = {}
// Reading the ch data
var ReadCh = function(ch, callback){
  adc.readADCSingleEnded(ch, progGainAmp, samplesPerSecond, function(err, data) {
    if(err){
      //logging / troubleshooting code goes here...
      throw err;
    }
    // if you made it here, then the data object contains your reading!
    ChData[ch] = ChData[ch].concat(data) // Putting data into

    //console.log ('channel  ' + ch + ': ' + data);
    // Calling the next ch or done
    callback();
  });
}

// A way to make the reads run one after the other with callbacks
var Readchall = function(){ReadCh(0, Readch1)};
var Readch1 = function(){ReadCh(1, Readch2)};
var Readch2 = function(){ReadCh(2, Readch3)};
var Readch3 = function(){ReadCh(3, ChDone)};
var ChDone = function(){
  if (count === '10') {
    ch1Avg = ChData[0]reduce((a,b) => a + b, 0) / ChData[0]length
    ch2Avg = ChData[1]reduce((a,b) => a + b, 0) / ChData[1]length
    ch3Avg = ChData[2]reduce((a,b) => a + b, 0) / ChData[2]length
    ch4Avg = ChData[3]reduce((a,b) => a + b, 0) / ChData[3]length

    var tempBotPlate = mvToC(ch1Avg, ch2Avg, 221, 1.4).temp
    var tempTopPlate = mvToC(ch3Avg, ch4Avg, 235, 19).temp
    var correctionTop  = ctrTop.update(tempTopPlate)
    var correctionBot  = ctrBot.update(tempBotPlate)

    console.log('Setpoint: ', setTarget + ' F')
    console.log('Temp Top Plate: ' + tempTopPlate + ' F')
    console.log('Correction: ', correctionTop)
    console.log('------------')
    console.log('Temp Bottom Plate: ' + tempBotPlate + ' F')
    console.log('Correction: ', correctionBot)
    console.log('------------')

    shouldISwitch('bottom', botPlateGPIO, correctionBot, thermistorBotOn)
    shouldISwitch('top', topPlateGPIO, correctionTop, thermistorTopOn)

    count = 0
    return
  }
  count++
// This is run after the 4 ch have been read
// console.log ('CH1: ' + (ChData[0]/dev).toFixed(2) +
// '\tCH2: ' + (ChData[1]/dev).toFixed(2) +
// '\tCH3: ' + (ChData[2]/dev).toFixed(2) +
// '\tCH4: ' + (ChData[3]/dev).toFixed(2) );
};

if(!adc.busy)
{

// Readchall(); // - one Time Read read all 4 ch

// OUTPUT
// CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60
gpio.setup(botPlateGPIO, gpio.DIR_IN, function () {
  gpio.read(botPlateGPIO, function(err, valueBot) {
    if (err) throw err;
    gpio.setup(topPlateGPIO, gpio.DIR_IN, function () {
      gpio.read(topPlateGPIO, function(err, valueTop) {
        if (err) throw err;
        console.log('')
        console.log('heater on/off ?');
        console.log(valueBot ? 'Bottom-ON' : 'Bottom-OFF')
        console.log(valueTop ? 'Top-ON' : 'Top-OFF')
        var iv = setInterval(Readchall, 100); // Repeat every 500msec
        // perfectTemp(adcSampleSize)
      })
    })
  })
})
// 100 (every 100msecs or 10 times a sec) is the max with this program
// will do with 4 ch being run each time and the Sample rate (On a pi3).

// OUTPUT
// CH1: 5.15 CH2: 0.03 CH3: 0.03 CH4: 4.60
// CH1: 5.15 CH2: 0.03 CH3: 0.03 CH4: 4.60
// CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60
// CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60

}

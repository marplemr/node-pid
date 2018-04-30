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
var chip = 1; //0 for ads1015, 1 for ads1115
var ctrTop = new Controller({
  k_p: 0.01,
  k_i: 0.01,
  k_d: 0.01,
  dt: 1
})
var ctrBot = new Controller({
  k_p: 0.01,
  k_i: 0.01,
  k_d: 0.01,
  dt: 1
})
var setTarget = 180
var interval = 500
var topPlateGPIO = 18
var botPlateGPIO = 99
var thermistorBotOn
var thermistorTopOn
ctrTop.setTarget(setTarget)
ctrBot.setTarget(setTarget)

//Simple usage (default ADS address on pi 2b or 3):
var adc = new ads1x15(chip);
var channel = 0; //channel 0, 1, 2, or 3...
var samplesPerSecond = '250'; // see index.js for allowed values for your chip
var progGainAmp = '512'; // see index.js for allowed values for your chip

function mvToC (mVCh1, mVCh2) {
  // var thermistorOhms = 3300/(mV/1000) - 1000
  var thermistorOhms = 221 * (1 / ((mVCh1 / mVCh2) - 1)) - 1.4
  // var celsius = (thermistorOhms/604 - 1)/0.00518
  var celsius = (thermistorOhms / 100 - 1) / 0.00385
  var far = celsius * (9 / 5) + 32
  return {temp: far, res: thermistorOhms}
}
// var ChData =[]; //somewhere to store our reading
// var dev = 127; // used to change Ch data to Voltage
var goalReachedBot = false
function perfectTemp () {
  console.log('')
  console.log('heaterTop:', ' ', thermistorTopOn ? 'ON' : 'OFF')
  console.log('heaterBot:', ' ', thermistorBotOn ? 'ON' : 'OFF')
  adc.readADCSingleEnded(channel, progGainAmp, samplesPerSecond, function(err, dataCh1) {
    if (err) {
      //logging / troubleshooting code goes here...
      throw err;
    }
    adc.readADCSingleEnded(1, progGainAmp, samplesPerSecond, function(err, dataCh2) {
      if (err) {
        //logging / troubleshooting code goes here...
        throw err;
      }
      adc.readADCSingleEnded(2, progGainAmp, samplesPerSecond, function(err, dataCh3) {
        if (err) {
          //logging / troubleshooting code goes here...
          throw err;
        }
        adc.readADCSingleEnded(3, progGainAmp, samplesPerSecond, function(err, dataCh4) {
          if (err) {
            //logging / troubleshooting code goes here...
            throw err;
          }
          // if you made it here, then the data object contains your reading!
          var mvCh1 = dataCh1 // Putting data into
          var mvCh2 = dataCh2
          var mvCh3 = dataCh3
          var mvCh4 = dataCh4
          var tempBotPlate = mvToC(mvCh1, mvCh2).temp
          var tempTopPlate = mvToC(mvCh3, mvCh4).temp
          var correctionTop  = ctrTop.update(tempTopPlate)
          var correctionBot  = ctrBot.update(tempBotPlate)
          console.log('Setpoint: ', setTarget + ' F')
          console.log('Temp Top Plate: ' + tempTopPlate + ' F')
          console.log('Correction: ', correctionTop)
          console.log('------------')
          console.log('Temp Bottom Plate: ' + tempBotPlate + ' F')
          console.log('Correction: ', correctionBottom)
          console.log('------------')
          // applyInputToActuator(input);
          function shouldISwitch (plate, gpioNum, correction) {
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

          shouldISwitch('bottom', topPlateGPIO, correctionBottom)
          return setTimeout(function() {
            perfectTemp()
          }, interval)
        })
      })
    })
  })
}

gpio.setup(topPlateGPIO, gpio.DIR_IN, function () {
  gpio.read(topPlateGPIO, function(err, value) {
    if (err) throw err;
    console.log('')
    console.log('heater on/off ?');
    console.log(value ? 'ON' : 'OFF')
    return setTimeout(function() {
      perfectTemp()
    }, interval)
  })
})

// Reading the ch data
// var ReadCh = function(ch, callback){
//   adc.readADCSingleEnded(ch, progGainAmp, samplesPerSecond, function(err, data) {
//     if(err){
//       //logging / troubleshooting code goes here...
//       throw err;
//     }
//     // if you made it here, then the data object contains your reading!
//     ChData[ch] = data // Putting data into
//
//     //console.log ('channel  ' + ch + ': ' + data);
//     // Calling the next ch or done
//     callback();
//   });
// }

// A way to make the reads run one after the other with callbacks
// var Readchall = function(){ReadCh(0, Readch1)};
// var Readch1 = function(){ReadCh(1, Readch2)};
// var Readch2 = function(){ReadCh(2, Readch3)};
// var Readch3 = function(){ReadCh(3, ChDone)};
// var ChDone = function(){
// // This is run after the 4 ch have been read
// console.log ('CH1: ' + (ChData[0]/dev).toFixed(2) +
// '\tCH2: ' + (ChData[1]/dev).toFixed(2) +
// '\tCH3: ' + (ChData[2]/dev).toFixed(2) +
// '\tCH4: ' + (ChData[3]/dev).toFixed(2) );
// };
//
// if(!adc.busy)
// {
//
// // Readchall(); // - one Time Read read all 4 ch
//
// // OUTPUT
// // CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60
//
// iv = setInterval(Readchall, 500); // Repeat every 500msec
// // 100 (every 100msecs or 10 times a sec) is the max with this program
// // will do with 4 ch being run each time and the Sample rate (On a pi3).
//
// // OUTPUT
// // CH1: 5.15 CH2: 0.03 CH3: 0.03 CH4: 4.60
// // CH1: 5.15 CH2: 0.03 CH3: 0.03 CH4: 4.60
// // CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60
// // CH1: 0.03 CH2: 0.03 CH3: 0.03 CH4: 4.60
//
// }

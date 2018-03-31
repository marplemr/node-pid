var Controller = require('node-pid-controller');
var ads1x15 = require('node-ads1x15');
var gpio = require('rpi-gpio');

var chip = 1; //0 for ads1015, 1 for ads1115
var ctr = new Controller({
  k_p: 0.25,
  k_i: 0.01,
  k_d: 0.01,
  dt: 1
});
var setTarget = 80
var thermistorOn
ctr.setTarget(setTarget);
gpio.on('change', function(channel, value) {
    // console.log('Channel ' + channel + ' value is now ' + value);
    thermistorOn = value
})
gpio.setup(18, gpio.DIR_IN, function () {
  gpio.read(18, function(err, value) {
    if (err) throw err;
    thermistorOn = value
  })
})
//Simple usage (default ADS address on pi 2b or 3):
var adc = new ads1x15(chip);
var channel = 0; //channel 0, 1, 2, or 3...
var samplesPerSecond = '250'; // see index.js for allowed values for your chip
var progGainAmp = '4096'; // see index.js for allowed values for your chip

function mvToC (mV) {
  var thermistorOhms = 3300/(mV/1000) - 1000
  var celsius = (thermistorOhms/604 - 1)/0.00518
  var far = celsius * (9/5) + 32
  return {temp: far, res: thermistorOhms}
}
// var ChData =[]; //somewhere to store our reading
// var dev = 127; // used to change Ch data to Voltage
var goalReached = false
function perfectTemp () {
  adc.readADCSingleEnded(channel, progGainAmp, samplesPerSecond, function(err, data) {
    if(err){
      //logging / troubleshooting code goes here...
      throw err;
    }
    // if you made it here, then the data object contains your reading!
    var mv = data // Putting data into
    var temp = mvToC(mv).temp
    var correction  = ctr.update(temp);
    console.log('')
    console.log('Setpoint: ', setTarget + ' C')
    console.log('Temp: ' + temp + ' C')
    console.log('Correction: ', correction)
    // applyInputToActuator(input);
    goalReached = (correction === 0) ? true : false; // in the case of continuous control, you let this variable 'false'
    if (goalReached) {
      console.log('perfectTemp!')
      return setTimeout(function() {
        perfectTemp()
      }, 1000)
    }
    if (correction > 0) {
      if (!thermistorOn) {
        gpio.setup(18, gpio.DIR_OUT, function () {
          gpio.write(18, true, function(err) {
            if (err) throw err;
            console.log('heater-ON!');
          })
        })
      }

      return setTimeout(function() {
        perfectTemp()
      }, 1000)
    }
    if (correction < 0) {
      if (thermistorOn) {
        gpio.setup(18, gpio.DIR_OUT, function () {
          gpio.write(18, false, function(err) {
            if (err) throw err;
            console.log('heater-OFF!');
          })
        })
      }

      return setTimeout(function() {
        perfectTemp()
      }, 1000)
    }


    //console.log ('channel  ' + ch + ': ' + data);
    // Calling the next ch or done
    // callback();
  });
}
perfectTemp()


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

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import FontAwesome from 'react-native-vector-icons/FontAwesome5';
import { StackScreenProps } from '@react-navigation/stack';
import { atob, btoa } from 'react-native-quick-base64'; // Convert Base64 for BLE
import Tts from 'react-native-tts'; // Import TTS library



const bleManager = new BleManager();
const getTimestamp = () => Date.now(); // msecond


const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const RX_CHARACTERISTIC_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"; // Write
const TX_CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"; // Notify

//const SERVICE_UUID = "180A";
//const RX_CHARACTERISTIC_UUID = "2A57"; // Write
//const TX_CHARACTERISTIC_UUID = "2A57"; // Notify



type RootStackParamList = {
  HomeScreen: { deviceId: string };
  BLEScanner: undefined;
};

type Props = StackScreenProps<RootStackParamList, 'HomeScreen'>;

export default function HomeScreen({ route, navigation }: Props) {
  const { deviceId } = route.params;
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [recognizedGesture, setRecognizedGesture] = useState<string>("Waiting for gesture...");
  const [isPlaying, setIsPlaying] = useState(false); // Play/Pause state
  const [isPaused, setIsPaused] = useState(false); // Pause state for text display
  const lastSpokenRef = useRef<string | null>(null);


  useEffect(() => {
    Tts.setDefaultLanguage('en-US'); // Set language for TTS
    Tts.setDefaultRate(0.5); // Adjust speech rate (0.5 is slower, 1 is normal)
    Tts.setIgnoreSilentSwitch("ignore"); // Play even when phone is on silent


    const connectAndSubscribe = async () => {
      try {
        const device = await bleManager.connectToDevice(deviceId);
        setConnectedDevice(device);

        await device.discoverAllServicesAndCharacteristics();

        // Subscribe to notifications (ESP32 → Phone)
        device.monitorCharacteristicForService(SERVICE_UUID, TX_CHARACTERISTIC_UUID, (error, characteristic) => {
          if (error) {
            console.log("❌ Notification Error:", error);
            return;
          }
          if (characteristic?.value && !isPaused) { // Only update if not paused
            const decodedValue = atob(characteristic.value);
            console.log("📩 Received Gesture:", decodedValue);

            const receivedTime = getTimestamp(); //timestamp data received
            console.log(`[Timestamp] BLE Data Received: ${receivedTime} ms`);

            setRecognizedGesture(decodedValue); //update text in the ui

            requestAnimationFrame(()=> {
              const displayTime = getTimestamp(); // text display timestamp
              const latency = displayTime - receivedTime;
              console.log(`[Timestamp] Text Displayed on UI: ${displayTime} ms`);
              console.log(`[Latency] Display Latency: ${latency} ms`);
              
            });
            
            //only speak if gesture has changed
            if (isPlaying && decodedValue !== lastSpokenRef.current){
              //const speechStartTime = getTimestamp();
              //console.log(`[Timestamp] Speech Started: ${speechStartTime} ms`);

              //const speechLatency = speechStartTime - displayTime;
              //console.log(`[Latency] Speech Latency: ${speechLatency} ms`);
              Tts.speak(decodedValue); // Automatically read out loud if playing
              lastSpokenRef.current = decodedValue;
            }
          }
        });

        console.log("✅ Subscribed to TX notifications");
      } catch (error) {
        console.log("❌ Connection Error:", error);
      }
    };

    connectAndSubscribe();
  }, [isPaused, isPlaying]); // Re-run effect when `isPaused` or `isPlaying` changes

  const sendDataToESP32 = async (message: string) => {
    if (connectedDevice) {
      try {
        const encodedMessage = btoa(message); // Encode string to Base64

        await connectedDevice.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          RX_CHARACTERISTIC_UUID,
          encodedMessage
        );

        console.log("📤 Sent:", message);
      } catch (error) {
        console.log("❌ Sending Failed:", error);
      }
    }
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => {
      if (prev) {
        Tts.pause(); // Pause speech if playing
      } else {
        Tts.resume(); // Resume speech if paused
      }
      return !prev;
    });
  };

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const startSpeaking = () => {
    if (recognizedGesture !== "Waiting for gesture...") {
      Tts.speak(recognizedGesture); // Start reading the displayed text
      setIsPlaying(true); // Update the state to playing
      lastSpokenRef.current = recognizedGesture;
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔹 Navigation Bar with Back Button and User Icon */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.navigate('BLEScanner')}>
          <FontAwesome name="arrow-left" size={22} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>VerbaGlove</Text>
        <FontAwesome name="user-circle" size={24} color="black" />
      </View>

      {/* Gesture Display */}
      <View style={styles.textDisplay}>
        <Text style={styles.displayText}>{recognizedGesture}</Text>
      </View>

      {/* Pause Button */}
      <TouchableOpacity style={styles.pauseButton} onPress={togglePause}>
        <Text style={styles.pauseButtonText}>{isPaused ? "Resume" : "Pause"}</Text>
      </TouchableOpacity>

      {/* Media Controls */}
      <View style={styles.mediaControls}>
        <FontAwesome name="backward" size={24} color="black" />
        
        {/* Play/Pause Button */}
        <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
          <FontAwesome name={isPlaying ? "pause" : "play"} size={24} color="black" />
        </TouchableOpacity>
        
        <FontAwesome name="forward" size={24} color="black" />
      </View>

      {/* Speech Button */}
      <TouchableOpacity style={styles.speechButton} onPress={startSpeaking}>
        <Text style={styles.speechText}>Speech</Text>
      </TouchableOpacity>

      {/* End Session Button */}
      <TouchableOpacity style={styles.endSessionButton} onPress={() => navigation.navigate('BLEScanner')}>
        <Text style={styles.endSessionText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingTop: 40,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 15,
    position: 'absolute',
    top: 0,
    backgroundColor: '#F5EEF8',
    height: 60,
    borderRadius: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily:'Times New Roman',
  },
  textDisplay: {
    width: '80%',
    height: 100,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginVertical: 20,
    bottom: 90,
  },
  displayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  pauseButton: {
    backgroundColor: '#4CAF50', // Green color
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 5,
    bottom: 70,
  },
  pauseButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '50%',
    marginBottom: 20,
    alignItems: 'center',
  },
  playPauseButton: {
    backgroundColor: '#E0E0E0',
    padding: 10,
    borderRadius: 50,
  },
  speechButton: {
    backgroundColor: 'purple',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  speechText: {
    color: 'white',
    fontWeight: 'bold',
  },
  endSessionButton: {
    backgroundColor: 'red', //red
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    top: 80,
  },
  endSessionText: {
    color: 'white',
    fontWeight: 'bold',
  },
});


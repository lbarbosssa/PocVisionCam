import React, { useState, useRef } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";

import {
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    // useCodeScanner,
    Camera
} from "react-native-vision-camera";



const CamScreen = () => {
    const [photoUri, setPhotoUri] = useState(null);
    const cameraRef = useRef(null);
    const device = useCameraDevice('back');
    const { hasPermission } = useCameraPermission();

    const takePhoto = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    qualityPrioritization: 'balanced',
                });
                setPhotoUri(photo.path); // Salva a URI da imagem capturada
                console.log(photo.path);


            } catch (error) {
                console.error("Erro ao capturar foto: ", error);
            }
        }
    };

    if (!hasPermission) return <Text>Sem Permissão</Text>;

    if (device == null) return <Text>Sem Câmera</Text>;

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet'
        
        if (frame.pixelFormat === 'rgb') {
            const buffer = frame.toArrayBuffer()
            const data = new Uint8Array(buffer)
            console.log(`Pixel at 0,0: RGB(${data[0]}, ${data[1]}, ${data[2]})`)
          }
    }, [])

    // const codeScanner = useCodeScanner({
    //     codeTypes: ['code-128'],
    //     onCodeScanned: (codes) => {
    //       console.log(`Scanned ${codes[0].value} codes!`)
    //     }
    //   })

    return (

        <View style={StyleSheet.absoluteFill}>
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                // format={device.formats[88]}
                pixelFormat="rgb"
                // zoom={2}
                // codeScanner={codeScanner} 
                photo={true} // Importante para habilitar o modo de captura de foto
            />

            {/* <Button title="Tirar Foto" onPress={takePhoto} /> */}
            {/* {photoUri && <Image style={{ width: '100%', height: '50%' }} source={{ uri: 'file://' + photoUri }} />} */}

        </View>
    );
};

export default CamScreen;
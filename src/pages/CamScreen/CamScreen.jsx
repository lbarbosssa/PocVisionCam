import React, { useState, useRef } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";

import {
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
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
        // console.log(`Frame: ${frame.width}x${frame.height} (${frame.pixelFormat})`)
    }, [])

    return (

        <View style={StyleSheet.absoluteFill}>
            <Camera
                ref={cameraRef}
                style={{ width: '100%', height: '50%' }}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                photo={true} // Importante para habilitar o modo de captura de foto
            />

            <Button title="Tirar Foto" onPress={takePhoto} />
            {photoUri && <Image style={{ width: '100%', height: '50%' }} source={{ uri: 'file://' + photoUri }} />}

        </View>
    );
};

export default CamScreen;
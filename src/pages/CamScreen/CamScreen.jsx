import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";
import { BorderTypes, ColorConversionCodes, DataTypes, ObjectType, OpenCV, ThresholdTypes } from "react-native-fast-opencv";

import {
    useCameraDevice,
    useCameraPermission,
    // useFrameProcessor,
    // useCodeScanner,
    Camera,
} from "react-native-vision-camera";
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';



const CamScreen = () => {
    const [photoUri, setPhotoUri] = useState(null);
    const [processedPhoto, setProcessedPhoto] = useState(null);
    const [photo, setPhoto] = useState(true);
    const cameraRef = useRef(null);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [error, setError] = useState(null);

    const onCameraInitialized = () => {
        setIsCameraInitialized(true);
    };


    const takePhoto = async () => {
        if (photoUri) {
            setPhotoUri(null);
            setProcessedPhoto(null)
            setPhoto(true)
        } else if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    qualityPrioritization: 'balanced',
                });
                setPhotoUri(photo.path); // Salva a URI da imagem capturada
                console.log(photo.path);
                // await processImage()


            } catch (error) {
                console.error("Erro ao capturar foto: ", error);
            }
        }
    };

    useEffect(() => {
        if (photoUri) {
            processImage();  // Chama o processImage apenas quando o photoUri for atualizado
        }
    }, [photoUri]);

    const processImage = async () => {
        try {
            const resizedImage = await ImageResizer.createResizedImage(
                photoUri,
                1200,
                1200,
                'PNG',
                100
            );

            const imagePath = resizedImage.path;
            const fileData = await RNFS.readFile(imagePath, 'base64');
            const src = OpenCV.base64ToMat(fileData);
            const dst = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
            const gray = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
            OpenCV.invoke('cvtColor', src, gray, ColorConversionCodes.COLOR_BGR2GRAY);
            const thresholdValue = 160; // Valor de threshold, ajustável conforme necessário
            OpenCV.invoke(
                'threshold',
                gray,
                dst,
                thresholdValue,
                200,
                ThresholdTypes.THRESH_BINARY
            );
            

            const dstResult = OpenCV.toJSValue(dst);
            setProcessedPhoto(`data:image/jpeg;base64,${dstResult.base64}`);
            OpenCV.clearBuffers();
            console.log('Imagem processada com sucesso');
            // console.log(dstResult.base64);


        } catch (error) {
            setError(`Erro ao processar a imagem: ${error}`);
            console.error('Erro ao processar a imagem:', error);
        }
    };




    if (!hasPermission) return <Text onPress={() => requestPermission()}>Sem Permissão</Text>;

    if (device == null) return <Text>Sem Câmera</Text>;


    // const frameProcessor = useFrameProcessor(async (frame) => {
    //     'worklet';
    //     console.log('frame')
    // }, []);


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
                isActive={isCameraInitialized}
                onInitialized={onCameraInitialized}
                pixelFormat="yuv"
                photo={photo} // Importante para habilitar o modo de captura de foto
            // frameProcessor={frameProcessor}
            // codeScanner={codeScanner} 
            />


            <Button title={photoUri ? 'Refazer' : 'Capturar'} onPress={takePhoto} />
            {/* <Button title={'Processar'} onPress={processImage} /> */}
            {processedPhoto && (
                <>
                    <Image style={{ width: '100%', height: '100%' }} source={{ uri: processedPhoto }} />
                </>
            )}

        </View>
    );
};

export default CamScreen;
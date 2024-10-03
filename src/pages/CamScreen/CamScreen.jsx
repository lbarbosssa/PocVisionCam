import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, Button, View, Image } from "react-native";
import {
    BorderTypes,
    ColorConversionCodes,
    ColormapTypes,
    ContourApproximationModes,
    DataTypes,
    LineTypes,
    ObjectType,
    OpenCV,
    RetrievalModes,
    ThresholdTypes,
} from "react-native-fast-opencv";
import ImageEditor from '@react-native-community/image-editor';

import {
    useCameraDevice,
    useCameraPermission,
    useFrameProcessor,
    // useCodeScanner,
    Camera,
    useSkiaFrameProcessor,
} from "react-native-vision-camera";
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { PaintStyle, Skia } from '@shopify/react-native-skia';

const paint = Skia.Paint();
paint.setStyle(PaintStyle.Fill);
paint.setColor(Skia.Color('rgba(0, 255, 0, 0.3)'));

const CamScreen = () => {
    const [photoUri, setPhotoUri] = useState(null);
    const [processedPhoto, setProcessedPhoto] = useState(null);
    const [thresholdValue, setThresholdValue] = useState(162);

    const [croppedImage, setCroppedImage] = useState(null);
    const [showCam, setShowCam] = useState(true);
    const cameraRef = useRef(null);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [error, setError] = useState(null);
    const { resize } = useResizePlugin();

    const onCameraInitialized = () => {
        setIsCameraInitialized(true);
    };


    const takePhoto = async () => {
        console.log('ué')
        if (photoUri) {
            setPhotoUri(null);
            setProcessedPhoto(null)
            setShowCam(true)
        } else if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    qualityPrioritization: 'balanced',
                });
                setShowCam(false)
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
    }, [photoUri, thresholdValue]);

    const processImage = async () => {
        try {
            const resizedImage = await ImageResizer.createResizedImage(
                photoUri,
                1000,
                1000,
                'PNG',
                100
            );

            const imagePath = resizedImage.path;
            const fileData = await RNFS.readFile(imagePath, 'base64');

            const src = OpenCV.base64ToMat(fileData);
            // const dst = OpenCV.createObject(ObjectType.Mat, 700, 700, DataTypes.CV_8U);
            const gray = OpenCV.createObject(ObjectType.Mat, 900, 900, DataTypes.CV_8U);

            OpenCV.invoke('cvtColor', src, gray, ColorConversionCodes.COLOR_BGR2GRAY);
            OpenCV.invoke(
                'threshold',
                gray,
                gray,
                thresholdValue,
                200,
                ThresholdTypes.THRESH_BINARY
            );


            // Detectar contornos
            const contours = OpenCV.createObject(ObjectType.MatVector);
            OpenCV.invoke(
                'findContours',
                gray,
                contours,
                RetrievalModes.RETR_TREE,
                ContourApproximationModes.CHAIN_APPROX_SIMPLE
            );
            const contoursMats = OpenCV.toJSValue(contours);
            // const rectangles: Rect[] = [];
            const rectangles = [];
            for (let i = 0; i < contoursMats.array.length; i++) {
                const contour = OpenCV.copyObjectFromVector(contours, i);
                const { value: area } = OpenCV.invoke('contourArea', contour, false);

                if (area > 3000) {
                    const rect = OpenCV.invoke('boundingRect', contour);
                    rectangles.push(OpenCV.toJSValue(rect));
                }
            }

            const rectangle = rectangles[0]; // Considera apenas o primeiro retângulo encontrado
            if (rectangle) {
                const { x, y, width, height } = rectangle;
                console.log({
                    height,
                    width,
                    x,
                    y
                });
            }

            const dstResult = OpenCV.toJSValue(gray);
            OpenCV.clearBuffers();
            console.log('Imagem processada com sucesso');
            await cropImage(`data:image/jpeg;base64,${dstResult.base64}`, rectangle);
            // console.log(dstResult.base64);


        } catch (error) {
            setError(`Erro ao processar a imagem: ${error}`);
            console.error('Erro ao processar a imagem:', error);
        }
    };

    const cropImage = async (base64Img, coords) => {
        // console.log(base64Img)
        try {
            // Defina as coordenadas de corte
            const marginWidth = 0; // Adicionar 20px de margem na largura
            const marginHeight = 0; // Adicionar 30px de margem na altura
            const cropData = {
                offset: {
                    x: Math.max(0, coords.x - marginWidth),
                    y: Math.max(0, coords.y - marginHeight),
                },
                size: {
                    width: coords.width + marginWidth * 2, // Adiciona a margem dos dois lados
                    height: coords.height + marginHeight * 2, // Adiciona a margem superior e inferior
                },
                format: 'png'
            };

            // Realize o crop
            const uri = await ImageEditor.cropImage(base64Img, cropData);

            // const b64 = await RNFS.readFile(uri, 'base64');
            console.log(uri.uri)
            setProcessedPhoto(uri.uri);
        } catch (error) {
            console.error('Erro ao cortar a imagem:', error);
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

    const frameProcessor = useSkiaFrameProcessor((frame) => {
        'worklet';

        const height = frame.height / 4;
        const width = frame.width / 4;

        const resized = resize(frame, {
            scale: {
                width: width,
                height: height,
            },
            pixelFormat: 'bgr',
            dataType: 'uint8',
        });

        const src = OpenCV.frameBufferToMat(height, width, 3, resized);
        const dst = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);

        OpenCV.invoke('cvtColor', src, dst, ColorConversionCodes.COLOR_BGR2GRAY);

        OpenCV.invoke(
            'threshold',
            dst,
            dst,
            thresholdValue,
            200,
            ThresholdTypes.THRESH_BINARY
        );


        const channels = OpenCV.createObject(ObjectType.MatVector);
        OpenCV.invoke('split', dst, channels);
        const grayChannel = OpenCV.copyObjectFromVector(channels, 0)
        const contours = OpenCV.createObject(ObjectType.MatVector);
        OpenCV.invoke(
            'findContours',
            grayChannel,
            contours,
            RetrievalModes.RETR_TREE,
            ContourApproximationModes.CHAIN_APPROX_SIMPLE
        );

        const contoursMats = OpenCV.toJSValue(contours);
        const rectangles = [];

        for (let i = 0; i < contoursMats.array.length; i++) {
            const contour = OpenCV.copyObjectFromVector(contours, i);
            const { value: area } = OpenCV.invoke('contourArea', contour, false);

            if (area > 3000) {
                const contourPoints =  OpenCV.invoke('boundingRect', contour);
                rectangles.push(contourPoints);
            }
        }

        console.log(rectangles)

        frame.render();

        for (const rect of rectangles) {
            const rectangle = OpenCV.toJSValue(rect);
            frame.drawRect(
                {

                    height: rectangle.height * 4,
                    width: rectangle.width * 4,
                    x: rectangle.x * 4,
                    y: rectangle.y * 4,
                },
                paint
            );
        }
        OpenCV.clearBuffers();
    }, []);

    return (
        <View style={StyleSheet.absoluteFill}>


            {/* <Button title={'Processar'} onPress={processImage} /> */}

            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                onInitialized={onCameraInitialized}
                pixelFormat="yuv"
                photo={false}
                frameProcessor={frameProcessor}
            // codeScanner={codeScanner} 
            />

            {processedPhoto && (
                <>
                    <Image style={{ width: '100%', height: '90%' }} source={{ uri: processedPhoto }} resizeMode="contain" />
                </>
            )}
            <Button title={photoUri ? 'Refazer' : 'Capturar'} onPress={takePhoto} />
            {/* <View style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row'
            }}>
                <Button title={'MENOS'} onPress={() => setThresholdValue(thresholdValue - 10)} />
                <Button title={'MAIS'} onPress={() => setThresholdValue(thresholdValue + 10)} />

            </View> */}
        </View>
    );
};

export default CamScreen;
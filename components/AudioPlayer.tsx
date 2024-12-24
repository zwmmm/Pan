import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { throttle } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import VolumeController from 'react-native-volume-controller';

interface AudioPlayerProps {
  uri: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri }) => {
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isSeeking, setIsSeeking] = useState(false);

  // 初始化音频系统
  const initAudio = async () => {
    try {
      // 请求音频权限
      await Audio.requestPermissionsAsync();
      // 设置音频模式
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      // 获取当前系统音量
      VolumeController.getVolume((volume: number) => {
        setVolume(volume);
      });
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  };

  // 初始化音频
  const loadAudio = async () => {
    try {
      // 先卸载之前的音频
      if (sound) {
        await sound.unloadAsync();
      }
      
      console.log('Loading audio from URI:', uri);
      const { sound: audioSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        onPlaybackStatusUpdate,
        true
      );
      
      console.log('Audio loaded, status:', status);
      setSound(audioSound);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  // 播放状态更新回调
  const onPlaybackStatusUpdate = throttle((status: any) => {
    if (status.isLoaded && !isSeeking) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
      console.log('Playback status:', status);
    }
  }, 100);

  // 处理播放/暂停
  const handlePlayPause = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        console.log('Pausing audio');
        await sound.pauseAsync();
      } else {
        console.log('Playing audio');
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  // 处理进度条变化开始
  const handleSlidingStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  // 处理进度条变化结束
  const handleSlidingComplete = useCallback(async (value: number) => {
    if (!sound) return;
    try {
      await sound.setPositionAsync(value);
      setPosition(value);
      setIsSeeking(false);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, [sound]);

  // 处理音量变化
  const handleVolumeChange = useCallback(async (value: number) => {
    try {
      // 设置系统音量
      VolumeController.change(value);
      // 同时设置当前音频音量
      if (sound) {
        await sound.setVolumeAsync(value);
      }
      setVolume(value);
    } catch (error) {
      console.error('Error changing volume:', error);
    }
  }, [sound]);

  // 监听系统音量变化
  useEffect(() => {
    const volumeListener = VolumeController.onChange((volume: number) => {
      setVolume(volume);
      // 同步更新当前音频音量
      sound?.setVolumeAsync(volume).catch(console.error);
    });

    return () => {
      // 清理监听器
      volumeListener.remove();
    };
  }, [sound]);

  // 格式化时间
  const formatTime = useCallback((milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 缓存的时间显示
  const formattedPosition = useMemo(() => formatTime(position), [formatTime, position]);
  const formattedDuration = useMemo(() => formatTime(duration), [formatTime, duration]);

  // 初始化音频系统
  useEffect(() => {
    initAudio();
  }, []);

  // 加载音频
  useEffect(() => {
    if (uri) {
      loadAudio();
    }
    return () => {
      sound?.unloadAsync();
    };
  }, [uri]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={handlePlayPause}
        style={styles.playButton}
        accessibilityRole="button"
      >
        <FontAwesome 
          name={isPlaying ? 'pause' : 'play'} 
          size={24} 
          color="#000" 
        />
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formattedPosition}</Text>
        <Slider
          style={styles.slider}
          value={position}
          minimumValue={0}
          maximumValue={duration}
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#1890ff"
          maximumTrackTintColor="#d9d9d9"
          thumbTintColor="#1890ff"
        />
        <Text style={styles.timeText}>{formattedDuration}</Text>
      </View>

      <View style={styles.volumeContainer}>
        <FontAwesome name="volume-up" size={20} color="#000" />
        <Slider
          style={styles.volumeSlider}
          value={volume}
          minimumValue={0}
          maximumValue={1}
          onSlidingComplete={handleVolumeChange}
          minimumTrackTintColor="#1890ff"
          maximumTrackTintColor="#d9d9d9"
          thumbTintColor="#1890ff"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playButton: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
    minWidth: 45,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  volumeSlider: {
    flex: 1,
    marginLeft: 8,
    height: 40,
  },
});

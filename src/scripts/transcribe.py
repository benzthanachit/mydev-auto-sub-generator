import sys
import json
import argparse
from faster_whisper import WhisperModel

def transcribe_audio(file_path, model_size="large-v3-turbo", device="cpu", compute_type="int8", language="th"):
    try:
        # Load the model
        model = WhisperModel(model_size, device=device, compute_type=compute_type)

        # Transcribe (forcing language to prevent hallucination)
        segments, info = model.transcribe(file_path, word_timestamps=True, language=language, condition_on_previous_text=False)

        output = {
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "segments": []
        }

        for segment in segments:
            seg_data = {
                "id": segment.id,
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": []
            }
            if segment.words:
                for word in segment.words:
                    seg_data["words"].append({
                        "word": word.word.strip(),
                        "start": word.start,
                        "end": word.end,
                        "probability": word.probability
                    })
            output["segments"].append(seg_data)

        # Print the output as JSON string to stdout
        print(json.dumps(output))

    except Exception as e:
        error_output = {"error": str(e)}
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio using faster-whisper")
    parser.add_argument("file_path", help="Path to the audio or video file")
    parser.add_argument("--model", default="large-v3-turbo", help="Model size (tiny, base, small, medium, large-v3, large-v3-turbo)")
    parser.add_argument("--device", default="cpu", help="Device to run on (cpu, cuda, mps)")
    parser.add_argument("--compute_type", default="int8", help="Compute type (int8, float16, float32)")
    parser.add_argument("--language", default="th", help="Force language (e.g., th for Thai)")
    
    args = parser.parse_args()
    
    # Silence warning logs if needed, but keeping simple for now
    transcribe_audio(args.file_path, args.model, args.device, args.compute_type, args.language)

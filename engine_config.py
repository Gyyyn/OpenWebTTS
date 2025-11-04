"""
TTS Engine Configuration System
Enables/disables TTS engines at startup
"""

import os
import json
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class EngineConfig:
    """Configuration for a TTS engine"""
    name: str
    enabled: bool = True
    display_name: str = ""
    description: str = ""
    requires_api_key: bool = False
    requires_model_files: bool = False
    model_directory: Optional[str] = None
    
    def __post_init__(self):
        if not self.display_name:
            self.display_name = self.name.capitalize()


class EngineManager:
    """Manages TTS engine configurations"""
    
    def __init__(self, config_file: str = "engine_config.json"):
        self.config_file = config_file
        self.engines: Dict[str, EngineConfig] = {}
        self._load_default_config()
        self._load_user_config()
    
    def _load_default_config(self):
        """Load default engine configurations"""
        default_engines = {
            "piper": EngineConfig(
                name="piper",
                enabled=True,
                display_name="Piper",
                description="Local TTS with memory efficient voices",
                requires_model_files=True,
                model_directory="piper"
            ),
            "kokoro": EngineConfig(
                name="kokoro",
                enabled=True,
                display_name="Kokoro",
                description="Local TTS with expressive voices",
                requires_model_files=True,
                model_directory="kokoro"
            ),
            "coqui": EngineConfig(
                name="coqui",
                enabled=True,
                display_name="Coqui",
                description="Local TTS voice cloning",
                requires_model_files=True,
                model_directory="coqui"
            ),
            "kitten": EngineConfig(
                name="kitten",
                enabled=True,
                display_name="Kitten",
                description="Local TTS with compact models",
                requires_model_files=False
            ),
            "gemini": EngineConfig(
                name="gemini",
                enabled=True,
                display_name="Google Cloud TTS",
                description="Cloud-based TTS with high quality voices",
                requires_api_key=True,
                requires_model_files=False
            )
        }
        self.engines = default_engines
    
    def _load_user_config(self):
        """Load user configuration from file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    user_config = json.load(f)
                
                for engine_name, config_data in user_config.items():
                    if engine_name in self.engines:
                        # Update existing engine config with user settings
                        for key, value in config_data.items():
                            if hasattr(self.engines[engine_name], key):
                                setattr(self.engines[engine_name], key, value)
            except Exception as e:
                print(f"Warning: Could not load engine configuration: {e}")
    
    def save_config(self):
        """Save current configuration to file"""
        try:
            config_data = {name: asdict(config) for name, config in self.engines.items()}
            with open(self.config_file, 'w') as f:
                json.dump(config_data, f, indent=2)
        except Exception as e:
            print(f"Error saving engine configuration: {e}")
    
    def enable_engine(self, engine_name: str):
        """Enable a specific engine"""
        if engine_name in self.engines:
            self.engines[engine_name].enabled = True
            self.save_config()
    
    def disable_engine(self, engine_name: str):
        """Disable a specific engine"""
        if engine_name in self.engines:
            self.engines[engine_name].enabled = False
            self.save_config()
    
    def get_enabled_engines(self) -> List[str]:
        """Get list of enabled engine names"""
        return [name for name, config in self.engines.items() if config.enabled]
    
    def get_engine_config(self, engine_name: str) -> Optional[EngineConfig]:
        """Get configuration for a specific engine"""
        return self.engines.get(engine_name)
    
    def is_engine_enabled(self, engine_name: str) -> bool:
        """Check if an engine is enabled"""
        config = self.get_engine_config(engine_name)
        return config.enabled if config else False
    
    def get_all_engines(self) -> Dict[str, EngineConfig]:
        """Get all engine configurations"""
        return self.engines.copy()


# Global engine manager instance
engine_manager = EngineManager()


def get_enabled_engines() -> List[str]:
    """Get list of enabled engine names"""
    return engine_manager.get_enabled_engines()


def is_engine_enabled(engine_name: str) -> bool:
    """Check if an engine is enabled"""
    return engine_manager.is_engine_enabled(engine_name)


def get_engine_config(engine_name: str) -> Optional[EngineConfig]:
    """Get configuration for a specific engine"""
    return engine_manager.get_engine_config(engine_name)

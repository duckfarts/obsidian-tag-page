import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from 'obsidian';
import { addButton } from './utils/button';
import { fetchTagData } from './utils/tagSearch';
import { generateTagPageContent } from './utils/pageContent';

export interface PluginSettings {
	mySetting: string;
	tagPageDir: string;
	frontmatterQueryProperty: string;
	bulletedSubItems?: boolean;
	includeLines?: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: 'default',
	tagPageDir: 'Tags',
	frontmatterQueryProperty: 'tage-page-query',
	bulletedSubItems: true,
	includeLines: true,
};

export interface TagInfo {
	fileLink: string;
	tagMatches: string[];
}

export default class TagPagePlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'create-tag-page',
			name: 'Create Tag Page',
			callback: () => {
				new CreateTagPageModal(this.app, this).open();
			},
		});

		this.registerEvent(
			this.app.workspace.on('file-open', () =>
				addButton(this.app, this.settings, this.refreshTagPageContent),
			),
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async refreshTagPageContent(
		activeLeaf: MarkdownView,
		tagOfInterest: string,
	): Promise<void> {
		const tagsInfo = await fetchTagData(
			this.app,
			this.settings,
			tagOfInterest,
		);
		const tagPageContentString = await generateTagPageContent(
			this.settings,
			tagsInfo,
			tagOfInterest,
		);

		const editor = activeLeaf?.editor;
		if (editor) {
			const currentFile = activeLeaf.file;
			if (
				currentFile &&
				currentFile.path.includes(this.settings.tagPageDir)
			) {
				editor.setValue(tagPageContentString);
			}
		}
	}

	async createTagPage(tag: string) {
		// Append # to tag if it doesn't exist
		const tagOfInterest = tag.startsWith('#') ? tag : `#${tag}`;

		// Create tag page if it doesn't exist
		const tagPage = this.app.vault.getAbstractFileByPath(
			`${this.settings.tagPageDir}/${tagOfInterest}.md`,
		);

		if (!tagPage) {
			const tagsInfo = await fetchTagData(
				this.app,
				this.settings,
				tagOfInterest,
			);
			const tagPageContentString = await generateTagPageContent(
				this.settings,
				tagsInfo,
				tagOfInterest,
			);

			// if tag page doesn't exist, create it and continue
			await this.app.vault.adapter
				// Check if tag page directory exists
				.exists(this.settings.tagPageDir)
				.then((exists) => {
					if (!exists) {
						this.app.vault.createFolder(this.settings.tagPageDir);
					}
				})
				.then(() => {
					return this.app.vault.create(
						`${this.settings.tagPageDir}/${tagOfInterest}.md`,
						tagPageContentString,
					);
				})
				.then((createdPage) => {
					// open file
					this.app.workspace.getLeaf().openFile(createdPage as TFile);
				});

			// Get bulleted lines with this tag
			// Can user's define rules for what lines to include?
			// Can they grab any subbullets of a bullet
			// Append to tag page with obsidian link to that page (can I link directly to line?)
		} else {
			// navigate to tag page
			await this.app.workspace.getLeaf().openFile(tagPage as TFile);
		}
	}
}

class CreateTagPageModal extends Modal {
	plugin: TagPagePlugin;

	constructor(app: App, plugin: TagPagePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Tag to create page for:');
		const tagForm = contentEl.createEl('form');
		contentEl.addClass('create-page-modal');

		// Input Element
		const input = tagForm.createEl('input', { type: 'text' });
		input.placeholder = '#tag';
		input.value = '#';

		input.addEventListener('keydown', (e) => {
			const cursorPosition = input.selectionStart;
			if (
				cursorPosition === 1 &&
				(e.key === 'Backspace' || e.key === 'Delete')
			) {
				e.preventDefault();
			}
		});

		// Submit Button
		const submitButton = tagForm.createEl('button', { type: 'submit' });
		submitButton.innerText = 'Create Tag Page';

		// Form submit listener
		tagForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const tag = input.value;
			this.contentEl.empty();
			this.contentEl.setText(`Creating tag page for ${tag}...`);
			await this.plugin.createTagPage(tag);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: TagPagePlugin;

	constructor(app: App, plugin: TagPagePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
